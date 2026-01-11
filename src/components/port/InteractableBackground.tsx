import React, { useEffect, useRef, useState } from 'react';
import { useCardRegistry } from './CardRegistry';

/**
 * InteractableBackground.tsx
 * 
 * Implements a dynamic ASCII background with:
 * - Directional Border Animations (Enter/Exit)
 * - Ambient "Blob" animation
 * - Wave simulation
 * - Navbar Fade-out
 */

interface Cell {
    energy: number;
    waveEnergy: number;
    prevWaveEnergy: number;
    char: string;
    isBlocker: boolean;
    isBorder: boolean;
    borderChar?: string;
    cardIndex?: number;
}

interface CardAnimState {
    lightCenter: number; // 0..1 (perimeter position)
    lightCoverage: number; // 0..0.5 (radius of light)
    darkCenter: number; // 0..1
    darkCoverage: number; // 0..0.5
    isHovered: boolean;
}

interface CardBounds {
    x: number;
    y: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
    isBlocker: boolean;
    isBorderEraser: boolean;
    groupId: string | null;
}

interface CardRegistry {
    getCardBounds: () => CardBounds[];
    getHoveredCardIndex: () => number;
    register: (id: string, element: HTMLElement | null) => void;
    unregister: (id: string) => void;
    subscribe: (listener: () => void) => () => void;
}

// Density string for energy mapping
const CHARS = '·,:+*x#%@';

// Helper: Get perimeter distance (0..1) for a point on the rect border
function getPerimeterPos(x: number, y: number, rect: { x: number, y: number, width: number, height: number }): number {
    const relX = x - rect.x;
    const relY = y - rect.y;
    const w = rect.width;
    const h = rect.height;

    // Clamping to ensure we are "inside" the bounding box logic for projection
    const clampedX = Math.max(0, Math.min(w, relX));
    const clampedY = Math.max(0, Math.min(h, relY));

    // Calculate distance to each edge
    const distTop = clampedY; // Distance from top (y=0)
    const distBottom = h - clampedY; // Distance from bottom (y=h)
    const distLeft = clampedX; // Distance from left (x=0)
    const distRight = w - clampedX; // Distance from right (x=w)

    const minDist = Math.min(distTop, distBottom, distLeft, distRight);

    // Total perimeter for normalization
    const totalPerim = 2 * (w + h);

    if (minDist === distTop) {
        // Top Edge: 0 to W
        return clampedX / totalPerim;
    } else if (minDist === distRight) {
        // Right Edge: W to W+H
        return (w + clampedY) / totalPerim;
    } else if (minDist === distBottom) {
        // Bottom Edge: W+H to 2W+H (Right to Left)
        // From right corner (W, H) to left corner (0, H)
        // distance traveled on bottom edge = (w - clampedX)
        return (w + h + (w - clampedX)) / totalPerim;
    } else {
        // Left Edge: 2W+H to 2W+2H (Bottom to Top)
        // From bottom corner (0, H) to top corner (0, 0)
        // distance traveled on left edge = (h - clampedY)
        return (2 * w + h + (h - clampedY)) / totalPerim;
    }
}

// Distance between two perimeter points (0..1) on a closed loop
function minDist(a: number, b: number): number {
    const diff = Math.abs(a - b);
    return Math.min(diff, 1 - diff);
}

export default function InteractableBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const registry = useCardRegistry() as CardRegistry;
    const [themeColors, setThemeColors] = useState({ bg: '#000000', fg: '#ffffff', border: '#ffffff', accent: '#33ff33' });

    // Animation states stored in a ref to persist across renders without re-triggering
    const animStatesRef = useRef<Map<number, CardAnimState>>(new Map());
    const prevHoveredRef = useRef<number>(-1);

    const CELL_SIZE = 16;
    const FONT_SIZE = 12;
    const DAMPING = 0.96;

    useEffect(() => {
        const updateTheme = () => {
            const style = getComputedStyle(document.body);
            setThemeColors({
                bg: style.getPropertyValue('--background') || '#000000',
                fg: style.getPropertyValue('--ascii-bg-color') || style.getPropertyValue('--foreground') || '#ffffff',
                border: style.getPropertyValue('--ascii-color') || style.getPropertyValue('--foreground') || '#ffffff',
                accent: style.getPropertyValue('--ascii-hover-color') || style.getPropertyValue('--foreground') || '#000000',
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
        let lastMousePos = { x: -1000, y: -1000 };
        let time = 0;

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
                cardIndex: undefined,
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
            const currentHoveredIdx = registry.getHoveredCardIndex();
            const prevHoveredIdx = prevHoveredRef.current;

            // --- 0. Animation State Updates ---

            // Check for Hover Change
            if (currentHoveredIdx !== prevHoveredIdx) {
                // Exit Event for Old
                if (prevHoveredIdx !== -1 && bounds[prevHoveredIdx]) {
                    const rect = bounds[prevHoveredIdx];
                    const exitPos = getPerimeterPos(mousePos.x, mousePos.y, rect);

                    if (!animStatesRef.current.has(prevHoveredIdx)) {
                        animStatesRef.current.set(prevHoveredIdx, {
                            lightCenter: 0, lightCoverage: 0,
                            darkCenter: exitPos, darkCoverage: 0,
                            isHovered: false
                        });
                    }
                    const state = animStatesRef.current.get(prevHoveredIdx)!;
                    state.isHovered = false;
                    state.darkCenter = exitPos;
                    state.darkCoverage = 0; // Reset dark expansion
                    // Light keeps its current state until consumed by dark
                }

                // Enter Event for New
                if (currentHoveredIdx !== -1 && bounds[currentHoveredIdx]) {
                    const rect = bounds[currentHoveredIdx];
                    const enterPos = getPerimeterPos(mousePos.x, mousePos.y, rect);

                    if (!animStatesRef.current.has(currentHoveredIdx)) {
                        animStatesRef.current.set(currentHoveredIdx, {
                            lightCenter: enterPos, lightCoverage: 0,
                            darkCenter: 0, darkCoverage: 1, // Already fully dark
                            isHovered: true
                        });
                    }
                    const state = animStatesRef.current.get(currentHoveredIdx)!;
                    state.isHovered = true;
                    state.lightCenter = enterPos;
                    state.lightCoverage = 0; // Reset light expansion
                    state.darkCoverage = 1; // Existing dark state doesn't really matter if light overwrites, but clean up
                }

                prevHoveredRef.current = currentHoveredIdx;
            }

            // Update anim progress
            const ANIM_SPEED = 0.04;
            animStatesRef.current.forEach((state) => {
                if (state.isHovered) {
                    // Expanding Light
                    if (state.lightCoverage < 0.6) { // 0.6 to be safe > 0.5
                        state.lightCoverage += ANIM_SPEED;
                    }
                } else {
                    // Expanding Dark (Removing Light)
                    if (state.darkCoverage < 0.6) {
                        state.darkCoverage += ANIM_SPEED;
                    } else {
                        // Animation complete, reset to clean state
                        state.lightCoverage = 0;
                        state.darkCoverage = 0;
                    }
                }
            });


            // --- 1. Identify Blockers/Borders ---
            for (let i = 0; i < grid.length; i++) {
                grid[i].isBlocker = false;
                grid[i].isBorder = false;
                grid[i].cardIndex = undefined;
            }

            bounds.forEach((rect, cardIdx) => {
                if (!rect.isBlocker) return;
                const startX = Math.floor(rect.x / CELL_SIZE);
                const endX = Math.floor(rect.right / CELL_SIZE);
                const startY = Math.floor(rect.y / CELL_SIZE);
                const endY = Math.floor(rect.bottom / CELL_SIZE);

                for (let y = startY; y <= endY; y++) {
                    for (let x = startX; x <= endX; x++) {
                        if (x < 0 || x >= cols || y < 0 || y >= rows) continue;
                        const idx = y * cols + x;
                        grid[idx].cardIndex = cardIdx; // Tracking

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

            // --- 2. Physics & Ambient ---
            // Linear Interpolation for smooth trails
            const dx = mousePos.x - lastMousePos.x;
            const dy = mousePos.y - lastMousePos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Interpolate steps if moved significantly to fill gaps
            const steps = Math.ceil(dist / (CELL_SIZE / 2));

            for (let i = 0; i <= steps; i++) {
                const t = steps > 0 ? i / steps : 1;
                const px = lastMousePos.x + dx * t;
                const py = lastMousePos.y + dy * t;

                const gx = Math.floor(px / CELL_SIZE);
                const gy = Math.floor(py / CELL_SIZE);

                if (gx >= 0 && gx < cols && gy >= 0 && gy < rows) {
                    const idx = gy * cols + gx;
                    // Inject energy
                    grid[idx].waveEnergy = Math.min(grid[idx].waveEnergy + 5.0, 10);
                }
            }

            lastMousePos.x = mousePos.x;
            lastMousePos.y = mousePos.y;

            const nextWaveEnergies = new Float32Array(grid.length);

            for (let y = 0; y < rows; y++) {
                for (let x = 0; x < cols; x++) {
                    const idx = y * cols + x;
                    const cell = grid[idx];
                    if (cell.isBlocker) continue;

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
                            if (!neighbor.isBlocker) {
                                sum += neighbor.waveEnergy;
                                count++;
                            }
                        }
                    }
                    nextWaveEnergies[idx] = (sum / count) * DAMPING;

                    // Ambient
                    const nx = x * 0.1;
                    const ny = y * 0.1;
                    const v = Math.sin(nx + time) + Math.sin(ny + time) + Math.sin((nx + ny + time) * 0.5);
                    const ambient = (v + 3) / 6;
                    grid[idx].energy = (ambient * 0.5) + nextWaveEnergies[idx];
                }
            }
            for (let i = 0; i < grid.length; i++) grid[i].waveEnergy = nextWaveEnergies[i];


            // --- 3. Draw ---
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
                    let color = themeColors.border;

                    if (cell.isBorder) {
                        char = cell.borderChar || '+';

                        // Default ambient glow check
                        let borderEnergy = cell.energy * 2.0;

                        // --- Border Animation Logic ---
                        if (cell.cardIndex !== undefined) {
                            const state = animStatesRef.current.get(cell.cardIndex);
                            if (state) {
                                // Calculate position of this specific border cell
                                const rect = bounds[cell.cardIndex];
                                // We need pixel coords for this cell to exact pos
                                // x, y are grid coords. px, py are centers.
                                const cellPos = getPerimeterPos(px, py, rect);

                                // Check Light
                                const distToLight = minDist(cellPos, state.lightCenter);
                                const isLit = distToLight < state.lightCoverage;

                                // Check Dark (Erasure)
                                // If not hovered, darkness spreads.
                                let isDarkened = false;
                                if (!state.isHovered) {
                                    const distToDark = minDist(cellPos, state.darkCenter);
                                    // REVERSED LOGIC:
                                    // Instead of darkness pushing OUT from center (dist < cov),
                                    // We want light to be PULLED IN to center.
                                    // Light exists only if dist < (Max - cov).
                                    // So Dark if dist > (Max - cov).
                                    const validRadius = 0.55 - state.darkCoverage;
                                    isDarkened = distToDark > validRadius;
                                }

                                if (isLit && !isDarkened) {
                                    borderEnergy = 3.0; // Highlight
                                }
                            }
                        }

                        alpha = 0.2 + (borderEnergy * 0.8);
                        if (alpha > 1) alpha = 1;
                        if (borderEnergy > 0.6) color = themeColors.accent;

                    } else {
                        color = themeColors.fg;
                        const energy = Math.max(0, Math.min(1, cell.energy));
                        const charIndex = Math.floor(energy * (CHARS.length - 1));
                        char = CHARS[charIndex];
                        alpha = 0.2 + (energy * 0.7);
                    }

                    // Navbar Fade
                    const fadeStart = 20;
                    if (py < fadeStart) {
                        const fadeFactor = Math.max(0, py / fadeStart);
                        alpha *= (fadeFactor * fadeFactor * fadeFactor);
                        if (alpha < 0.01) char = '';
                    }

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
