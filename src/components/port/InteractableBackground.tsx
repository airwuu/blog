import React, { useEffect, useRef, useState } from 'react';
import { useCardRegistry } from './CardRegistry';

/**
 * InteractableBackground.tsx
 * 
 * Implements a dynamic ASCII background with:
 * - Wave simulation (fluid energy flow)
 * - Mouse interaction
 * - "Pooling" blocking effect against TuiCards
 * - Glowing ASCII borders
 */

interface Point {
    x: number;
    y: number;
}

interface Cell {
    energy: number;     // Current energy/brightness
    prevEnergy: number; // For verlet/wave physics
    char: string;
    isBlocker: boolean;
    isBorder: boolean;
    borderChar?: string; // |, -, +, etc.
}

export default function InteractableBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const registry = useCardRegistry();
    const [themeColors, setThemeColors] = useState({ bg: '#000000', fg: '#ffffff', accent: '#33ff33' });

    // Configuration
    const CELL_SIZE = 16; // px
    const FONT_SIZE = 12;
    const DAMPING = 0.96; // Wave decay
    const NEIGHBOR_FLOW = 0.2; // How much energy flows to neighbors

    useEffect(() => {
        // Resolve theme colors from CSS variables
        const updateTheme = () => {
            const style = getComputedStyle(document.body);
            // We use a canvas trick or just standard conversion if possible. 
            // Since oklch is tricky in canvas on some browsers, we might rely on the browser resolving it if we set it as fillStyle.
            // But for clearRect we need dimensions. 
            // For now, let's just use the variable strings directly in fillStyle where supported, 
            // or fallback to basic detection.
            setThemeColors({
                bg: style.getPropertyValue('--background') || '#000000',
                fg: style.getPropertyValue('--foreground') || '#ffffff',
                accent: style.getPropertyValue('--secondary') || '#00ff00',
            });
        };
        updateTheme();
        window.addEventListener('resize', updateTheme); // Also updates on theme toggle technically if it triggers resize

        const observer = new MutationObserver(updateTheme);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

        return () => {
            window.removeEventListener('resize', updateTheme);
            observer.disconnect();
        };
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: false }); // Performance optimization
        if (!ctx) return;

        let animationFrameId: number;
        let cols = 0;
        let rows = 0;
        let grid: Cell[] = [];
        let mousePos = { x: -1000, y: -1000 };

        // Resize handler
        const handleResize = () => {
            // Handle high DPI displays
            const dpr = window.devicePixelRatio || 1;
            const rect = canvas.getBoundingClientRect();

            canvas.width = window.innerWidth * dpr;
            canvas.height = window.innerHeight * dpr;

            // CSS size
            canvas.style.width = `${window.innerWidth}px`;
            canvas.style.height = `${window.innerHeight}px`;

            ctx.scale(dpr, dpr);

            // Re-calc grid dimensions
            cols = Math.ceil(window.innerWidth / CELL_SIZE) + 1;
            rows = Math.ceil(window.innerHeight / CELL_SIZE) + 1;

            // Initialize grid
            grid = new Array(cols * rows).fill(null).map(() => ({
                energy: 0,
                prevEnergy: 0,
                char: '.',
                isBlocker: false,
                isBorder: false,
            }));
        };

        handleResize();
        window.addEventListener('resize', handleResize);

        // Mouse tracking
        const handleMouseMove = (e: MouseEvent) => {
            mousePos.x = e.clientX;
            mousePos.y = e.clientY;
        };
        window.addEventListener('mousemove', handleMouseMove);


        const render = () => {
            const bounds = registry.getCardBounds();

            // 1. Update Grid State (Identify blockers/borders from registry)
            // This needs to be efficient. We map cards to grid cells.

            // Reset blockers/borders first
            // Optimization: Only reset if bounds changed or periodically. 
            // For fluid UI, we can do it every frame or every few frames.
            // Let's do it every frame for smoothness with moving cards, but optimize the loops.
            for (let i = 0; i < grid.length; i++) {
                grid[i].isBlocker = false;
                grid[i].isBorder = false;
                grid[i].borderChar = undefined;
            }

            bounds.forEach(rect => {
                if (!rect.isBlocker) return;

                // Convert rect to grid coords
                const startX = Math.floor(rect.x / CELL_SIZE);
                const endX = Math.floor(rect.right / CELL_SIZE);
                const startY = Math.floor(rect.y / CELL_SIZE);
                const endY = Math.floor(rect.bottom / CELL_SIZE);

                // Mark grid cells
                for (let y = startY; y <= endY; y++) {
                    for (let x = startX; x <= endX; x++) {
                        if (x < 0 || x >= cols || y < 0 || y >= rows) continue;
                        const idx = y * cols + x;

                        // Check if it's a border cell
                        const isTop = y === startY;
                        const isBottom = y === endY;
                        const isLeft = x === startX;
                        const isRight = x === endX;

                        if (isTop || isBottom || isLeft || isRight) {
                            grid[idx].isBorder = true;
                            // Determine border char (corner logic)
                            if (isTop && isLeft) grid[idx].borderChar = '+';
                            else if (isTop && isRight) grid[idx].borderChar = '+';
                            else if (isBottom && isLeft) grid[idx].borderChar = '+';
                            else if (isBottom && isRight) grid[idx].borderChar = '+';
                            else if (isTop || isBottom) grid[idx].borderChar = '-';
                            else grid[idx].borderChar = '|';
                        } else {
                            grid[idx].isBlocker = true;
                        }
                    }
                }
            });


            // 2. Physics Simulation (Wave Propagation)
            // convert mouse pos to grid
            const mouseGridX = Math.floor(mousePos.x / CELL_SIZE);
            const mouseGridY = Math.floor(mousePos.y / CELL_SIZE);

            // Apply mouse energy
            if (mouseGridX >= 0 && mouseGridX < cols && mouseGridY >= 0 && mouseGridY < rows) {
                const idx = mouseGridY * cols + mouseGridX;
                grid[idx].energy = Math.min(grid[idx].energy + 2, 5); // Add energy cap
            }

            // Buffer for next state to avoid reading updated values in same pass
            const nextEnergies = new Float32Array(grid.length);

            for (let y = 0; y < rows; y++) {
                for (let x = 0; x < cols; x++) {
                    const idx = y * cols + x;
                    const cell = grid[idx];

                    // If inside blocker, energy dies immediately
                    if (cell.isBlocker) {
                        nextEnergies[idx] = 0;
                        continue;
                    }

                    // Propagate
                    // Simple averaging/diffusion
                    let sum = cell.energy;
                    let count = 1;

                    const neighbors = [
                        { dx: 0, dy: -1 }, // N
                        { dx: 0, dy: 1 },  // S
                        { dx: -1, dy: 0 }, // W
                        { dx: 1, dy: 0 }   // E
                    ];

                    for (const { dx, dy } of neighbors) {
                        const nx = x + dx;
                        const ny = y + dy;

                        if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
                            const nIdx = ny * cols + nx;
                            const neighbor = grid[nIdx];

                            // Essential "Pooling" Logic:
                            // If neighbor is a BLOCKER, we treat it as a wall.
                            // We reflect energy back or accumulate it here.
                            // Simplified: We don't take energy FROM blocker, we just don't give it.
                            // But if we want pooling, being Next to a blocker should Keep energy higher.

                            if (neighbor.isBlocker) {
                                // "Bounce" - Artificially increase own energy slightly to simulate accumulation?
                                // Or just don't lose energy to that side.
                                // Let's try: Don't count it in average (effectively insulation) 
                                // AND add a small reflection bonus if we have energy
                                if (cell.energy > 0.1) {
                                    sum += cell.energy * 0.1; // Accumulate against wall
                                }
                            } else {
                                sum += neighbor.energy;
                                count++;
                            }
                        }
                    }

                    const average = sum / count;
                    // Move towards average but keep some momentum (not implementing full verlet for simplicity/stability)
                    // Just simple diffusion + decay
                    nextEnergies[idx] = average * DAMPING;
                }
            }

            // Apply next energies
            for (let i = 0; i < grid.length; i++) {
                grid[i].energy = nextEnergies[i];
            }


            // 3. Draw
            // Clear background
            ctx.fillStyle = themeColors.bg;
            ctx.fillRect(0, 0, canvas.width, canvas.height); // Use full buffer size

            ctx.font = `${FONT_SIZE}px monospace`;
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'center';

            for (let y = 0; y < rows; y++) {
                for (let x = 0; x < cols; x++) {
                    const idx = y * cols + x;
                    const cell = grid[idx];

                    if (cell.isBlocker) continue; // Don't draw inside cards

                    const px = x * CELL_SIZE + CELL_SIZE / 2;
                    const py = y * CELL_SIZE + CELL_SIZE / 2;

                    let char = '.';
                    let alpha = 0.2;
                    let color = themeColors.fg;

                    // Visualize Energy
                    if (cell.isBorder) {
                        char = cell.borderChar || '+';
                        // Border glows with energy
                        // Base visibility + energy boost
                        alpha = 0.3 + (cell.energy * 0.8);
                        if (alpha > 1) alpha = 1;
                        // Color shift for high energy borders
                        if (cell.energy > 0.5) {
                            color = themeColors.accent; // Glow color
                        }
                    } else {
                        // Background cells
                        if (cell.energy > 0.1) {
                            char = '+';
                            alpha = 0.2 + (cell.energy * 0.5);
                        } else {
                            char = '.';
                            alpha = 0.1; // Dim base
                        }
                    }

                    // Cap alpha
                    if (alpha > 1) alpha = 1;

                    // Draw
                    ctx.fillStyle = color; // Uses css var string or hex
                    ctx.globalAlpha = alpha;
                    ctx.fillText(char, px, py);
                }
            }
            ctx.globalAlpha = 1;

            animationFrameId = requestAnimationFrame(render);
        };

        render();

        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('mousemove', handleMouseMove);
        };
    }, [themeColors, registry]); // Re-bind if theme changes

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 pointer-events-none z-[-1]"
            style={{ width: '100%', height: '100%' }}
        />
    );
}
