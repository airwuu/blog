import React, { useEffect, useRef, useState } from 'react';
import { useCardRegistry } from './CardRegistry';

/**
 * InteractableBackground.tsx
 * 
 * Implements a dynamic ASCII background with:
 * - Ambient "Blob" animation (plasma/noise effect)
 * - Wave simulation (fluid energy flow from mouse)
 * - Dynamic Character Set mapping (energy -> char)
 * - "Pooling" blocking effect against TuiCards
 * - Glowing ASCII borders
 */

interface Cell {
    energy: number;     // Current energy (physics + ambient)
    waveEnergy: number; // Just the wave/mouse energy part
    prevWaveEnergy: number;
    char: string;
    isBlocker: boolean;
    isBorder: boolean;
    borderChar?: string;
}

// Density string for energy mapping
const CHARS = '·,:+*x#%@'; // Low to high energy

export default function InteractableBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const registry = useCardRegistry();
    const [themeColors, setThemeColors] = useState({ bg: '#000000', fg: '#ffffff', accent: '#33ff33' });

    const CELL_SIZE = 16;
    const FONT_SIZE = 12;
    const DAMPING = 0.96;

    useEffect(() => {
        const updateTheme = () => {
            const style = getComputedStyle(document.body);
            setThemeColors({
                bg: style.getPropertyValue('--background') || '#000000',
                fg: style.getPropertyValue('--ascii-color') || style.getPropertyValue('--foreground') || '#ffffff',
                accent: style.getPropertyValue('--secondary') || '#00ff00',
            });
        };
        updateTheme();
        window.addEventListener('resize', updateTheme);
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
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        let animationFrameId: number;
        let cols = 0;
        let rows = 0;
        let grid: Cell[] = [];
        let mousePos = { x: -1000, y: -1000 };
        let time = 0; // For ambient noise

        const handleResize = () => {
            const dpr = window.devicePixelRatio || 1;
            canvas.width = window.innerWidth * dpr;
            canvas.height = window.innerHeight * dpr;
            canvas.style.width = `${window.innerWidth}px`;
            canvas.style.height = `${window.innerHeight}px`;
            ctx.scale(dpr, dpr);

            cols = Math.ceil(window.innerWidth / CELL_SIZE) + 1;
            rows = Math.ceil(window.innerHeight / CELL_SIZE) + 1;

            grid = new Array(cols * rows).fill(null).map(() => ({
                energy: 0,
                waveEnergy: 0,
                prevWaveEnergy: 0,
                char: CHARS[0],
                isBlocker: false,
                isBorder: false,
            }));
        };

        handleResize();
        window.addEventListener('resize', handleResize);

        const handleMouseMove = (e: MouseEvent) => {
            mousePos.x = e.clientX;
            mousePos.y = e.clientY;
        };
        window.addEventListener('mousemove', handleMouseMove);

        const render = () => {
            time += 0.01;
            const bounds = registry.getCardBounds();

            // 1. Identify Blockers/Borders
            for (let i = 0; i < grid.length; i++) {
                grid[i].isBlocker = false;
                grid[i].isBorder = false;
                grid[i].borderChar = undefined;
            }

            bounds.forEach(rect => {
                if (!rect.isBlocker) return;
                const startX = Math.floor(rect.x / CELL_SIZE);
                const endX = Math.floor(rect.right / CELL_SIZE);
                const startY = Math.floor(rect.y / CELL_SIZE);
                const endY = Math.floor(rect.bottom / CELL_SIZE);

                for (let y = startY; y <= endY; y++) {
                    for (let x = startX; x <= endX; x++) {
                        if (x < 0 || x >= cols || y < 0 || y >= rows) continue;
                        const idx = y * cols + x;

                        const isTop = y === startY;
                        const isBottom = y === endY;
                        const isLeft = x === startX;
                        const isRight = x === endX;

                        if (isTop || isBottom || isLeft || isRight) {
                            grid[idx].isBorder = true;
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

            // 2. Physics & Ambient Calculation
            const mouseGridX = Math.floor(mousePos.x / CELL_SIZE);
            const mouseGridY = Math.floor(mousePos.y / CELL_SIZE);

            if (mouseGridX >= 0 && mouseGridX < cols && mouseGridY >= 0 && mouseGridY < rows) {
                const idx = mouseGridY * cols + mouseGridX;
                grid[idx].waveEnergy = Math.min(grid[idx].waveEnergy + 5.0, 10);
            }

            const nextWaveEnergies = new Float32Array(grid.length);

            for (let y = 0; y < rows; y++) {
                for (let x = 0; x < cols; x++) {
                    const idx = y * cols + x;
                    const cell = grid[idx];

                    if (cell.isBlocker) {
                        nextWaveEnergies[idx] = 0;
                        continue;
                    }

                    // --- Wave Propagation ---
                    let sum = cell.waveEnergy;
                    let count = 1;

                    const neighbors = [
                        { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
                        { dx: -1, dy: 0 }, { dx: 1, dy: 0 }
                    ];

                    for (const { dx, dy } of neighbors) {
                        const nx = x + dx;
                        const ny = y + dy;

                        if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
                            const nIdx = ny * cols + nx;
                            const neighbor = grid[nIdx];

                            if (neighbor.isBlocker) {
                                // Blockers act as insulators - no energy flow into them
                                // We simply don't add them to the average calculation
                                // This causes energy to "stick" in cells near borders (pooling)
                                // without creating an unstable feedback loop.
                            } else {
                                sum += neighbor.waveEnergy;
                                count++;
                            }
                        }
                    }

                    const average = sum / count;
                    nextWaveEnergies[idx] = average * DAMPING;

                    // --- Ambient Noise ("Blobs") ---
                    // Simple plasma: combination of sines
                    // Scale coords for smoother noise
                    const nx = x * 0.1;
                    const ny = y * 0.1;
                    const v = Math.sin(nx + time) +
                        Math.sin(ny + time) +
                        Math.sin((nx + ny + time) * 0.5);
                    // Map v (-3 to 3) to 0-1 range roughly, then scale
                    const ambient = (v + 3) / 6; // 0.0 to 1.0

                    // Final Energy Composition
                    // Add wave energy on top of ambient
                    // Ambient is low-level (0.0 - 0.3), Wave is high-level (0.0 - 1.0+)

                    grid[idx].energy = (ambient * 0.3) + nextWaveEnergies[idx];
                }
            }

            // Commit next state
            for (let i = 0; i < grid.length; i++) {
                grid[i].waveEnergy = nextWaveEnergies[i];
            }

            // 3. Draw
            ctx.fillStyle = themeColors.bg;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.font = `${FONT_SIZE}px monospace`;
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'center';

            for (let y = 0; y < rows; y++) {
                for (let x = 0; x < cols; x++) {
                    const idx = y * cols + x;
                    const cell = grid[idx];

                    if (cell.isBlocker) continue;

                    const px = x * CELL_SIZE + CELL_SIZE / 2;
                    const py = y * CELL_SIZE + CELL_SIZE / 2;

                    let char = CHARS[0];
                    let alpha = 0.15;
                    let color = themeColors.fg;
                    // Visualize Energy
                    if (cell.isBorder) {
                        char = cell.borderChar || '+';
                        // Border glow based on wave energy primarily, plus some ambient
                        const borderEnergy = cell.energy * 2.0;
                        alpha = 0.2 + (borderEnergy * 0.8);
                        if (alpha > 1) alpha = 1;
                        if (borderEnergy > 0.6) color = themeColors.accent;
                    } else {
                        // Map energy to char
                        const energy = Math.max(0, Math.min(1, cell.energy));
                        // Quantize energy to char index
                        const charIndex = Math.floor(energy * (CHARS.length - 1));
                        char = CHARS[charIndex];

                        // Alpha follows energy too
                        alpha = 0.1 + (energy * 0.7);
                    }

                    // --- Fade Mask for Navbar ---
                    // Fade out the top 120px
                    const fadeStart = 120;
                    if (py < fadeStart) {
                        const fadeFactor = Math.max(0, py / fadeStart);
                        // Apply cubic easing for smoother fade
                        const easedFade = fadeFactor * fadeFactor * fadeFactor;
                        alpha *= easedFade;

                        // Also dim/change char if heavily faded?
                        // Just alpha is cleaner for "dissipating"
                        if (alpha < 0.01) char = ''; // Don't draw if invisible
                    }

                    // Cap alpha
                    if (alpha > 1) alpha = 1;
                    ctx.fillStyle = color;
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
    }, [themeColors, registry]);

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 pointer-events-none z-[-1]"
            style={{ width: '100%', height: '100%' }}
        />
    );
}
