import { useEffect, useRef } from 'react';
import { useCardRegistry } from './CardRegistry';
import './InteractableBackground.css';

const ASCII_CHARS = ' .:-=+*#%@';
const BOX_CHARS = {
    topLeft: '=',
    topRight: '=',
    bottomLeft: '=',
    bottomRight: '=',
    horizontal: '-',
    vertical: '|',
};

// Theme-aware color generation
const getThemeColors = () => {
    const isDark = document.documentElement.classList.contains('dark');

    // Generate color palette based on theme
    const colorCache = [];
    for (let i = 0; i <= 100; i++) {
        const intensity = i / 100;
        if (isDark) {
            // Dark mode: muted green to match site's secondary accent
            const hue = 130 + intensity * 20; // 130-150 range (muted green)
            const saturation = 8 + intensity * 12; // low saturation to match theme
            const lightness = 15 + intensity * 25;
            const alpha = 0.18 + intensity * 0.52;
            colorCache[i] = `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
        } else {
            // Light mode: subtle warm/neutral tones
            const hue = 30 + intensity * 20;
            const saturation = 10 + intensity * 15;
            const lightness = 70 - intensity * 25;
            const alpha = 0.08 + intensity * 0.35;
            colorCache[i] = `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
        }
    }

    return {
        colorCache,
        bgColor: isDark ? '#1a1816' : '#f5f3ef', // warm dark brown
        borderColor: isDark ? 'rgba(180, 140, 100, 0.5)' : 'rgba(80, 60, 40, 0.4)',
        innerColor: isDark ? 'rgba(140, 100, 60, 0.12)' : 'rgba(120, 100, 80, 0.08)',
    };
};

// Pre-compute squared thresholds to avoid Math.sqrt
const WAVE_MAX_DIST_SQ = 250000; // 500^2
const WAVE_RING_WIDTH = 60;
const WAVE_RING_WIDTH_SQ = WAVE_RING_WIDTH * WAVE_RING_WIDTH;

export default function InteractableBackground() {
    const canvasRef = useRef(null);
    const mouseHistoryRef = useRef([]);
    const animationRef = useRef(null);
    const cardRegistry = useCardRegistry();
    const cardBoundsRef = useRef([]);
    // Cache for card cell data (border cells, inside cells)
    const cardCellCacheRef = useRef({ cols: 0, rows: 0, borderCells: null, insideCells: null });

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d', { alpha: false });

        // Target approximately 120 columns max for performance
        const TARGET_MAX_COLS = 120;
        const BASE_FONT_SIZE = 14;

        let fontSize = BASE_FONT_SIZE;
        let charWidth = fontSize * 0.65;
        let charHeight = fontSize * 1.1;

        let cols = 0;
        let rows = 0;
        let offsets = null;

        // Set font once (optimization: avoid setting every frame)
        const setupFont = () => {
            ctx.font = `${fontSize}px monospace`;
            ctx.textBaseline = 'top';
        };

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;

            // Scale font size based on screen width to maintain ~80 columns max
            // On larger screens, characters get bigger to reduce cell count
            const rawCols = canvas.width / (BASE_FONT_SIZE * 0.65);
            if (rawCols > TARGET_MAX_COLS) {
                // Scale up font size to reduce column count
                fontSize = Math.ceil(canvas.width / (TARGET_MAX_COLS * 0.65));
            } else {
                fontSize = BASE_FONT_SIZE;
            }

            charWidth = fontSize * 0.65;
            charHeight = fontSize * 1.1;

            cols = Math.ceil(canvas.width / charWidth);
            rows = Math.ceil(canvas.height / charHeight);
            offsets = new Float32Array(cols * rows);
            for (let i = 0; i < offsets.length; i++) {
                offsets[i] = Math.random() * Math.PI * 2;
            }
            setupFont();
            // Invalidate card cell cache on resize
            cardCellCacheRef.current = { cols: 0, rows: 0, borderCells: null, insideCells: null };
        };

        // Simplified noise using pre-computed sin table would be even faster,
        // but keeping current approach for visual consistency
        const noise = (x, y, t) => {
            const scale = 0.1;
            const ts = t * 0.0008;
            return (
                Math.sin(x * scale + ts) * 0.4 +
                Math.cos(y * scale * 1.3 + ts * 0.7) * 0.4 +
                Math.sin((x + y) * scale * 0.5 + ts * 1.2) * 0.2
            ) * 0.5 + 0.5;
        };

        const getColor = (intensity, colorCache) => {
            const idx = Math.min(100, Math.max(0, (intensity * 100) | 0));
            return colorCache[idx];
        };

        // Build cell cache for cards (which cells are borders, which are inside)
        const buildCardCellCache = (cards, currentCols, currentRows) => {
            const cache = cardCellCacheRef.current;
            if (cache.cols === currentCols && cache.rows === currentRows && cache.borderCells) {
                return cache;
            }

            // Use Uint8Array for memory efficiency
            // 0 = normal, 1 = inside card, 2+ = border with char type
            const cellTypes = new Uint8Array(currentCols * currentRows);
            const borderChars = new Array(currentCols * currentRows);

            for (const card of cards) {
                // Convert card bounds to cell indices
                const startCol = Math.max(0, Math.floor((card.x - charWidth) / charWidth));
                const endCol = Math.min(currentCols - 1, Math.ceil((card.right + charWidth) / charWidth));
                const startRow = Math.max(0, Math.floor((card.y - charHeight) / charHeight));
                const endRow = Math.min(currentRows - 1, Math.ceil((card.bottom + charHeight) / charHeight));

                for (let row = startRow; row <= endRow; row++) {
                    for (let col = startCol; col <= endCol; col++) {
                        const idx = row * currentCols + col;
                        const posX = col * charWidth;
                        const posY = row * charHeight;

                        // Check if inside card
                        if (posX >= card.x && posX <= card.right &&
                            posY >= card.y && posY <= card.bottom) {
                            cellTypes[idx] = 1; // inside
                            continue;
                        }

                        // Check if on border
                        const onTop = posY >= card.y - charHeight && posY < card.y + charHeight && posX >= card.x - charWidth && posX <= card.right + charWidth;
                        const onBottom = posY >= card.bottom - charHeight && posY <= card.bottom + charHeight && posX >= card.x - charWidth && posX <= card.right + charWidth;
                        const onLeft = posX >= card.x - charWidth && posX < card.x + charWidth && posY >= card.y && posY <= card.bottom;
                        const onRight = posX >= card.right - charWidth && posX <= card.right + charWidth && posY >= card.y && posY <= card.bottom;

                        if (onTop || onBottom || onLeft || onRight) {
                            const isCornerTL = posY < card.y + charHeight && posX < card.x + charWidth;
                            const isCornerTR = posY < card.y + charHeight && posX >= card.right - charWidth;
                            const isCornerBL = posY >= card.bottom - charHeight && posX < card.x + charWidth;
                            const isCornerBR = posY >= card.bottom - charHeight && posX >= card.right - charWidth;

                            cellTypes[idx] = 2; // border
                            if (isCornerTL) borderChars[idx] = BOX_CHARS.topLeft;
                            else if (isCornerTR) borderChars[idx] = BOX_CHARS.topRight;
                            else if (isCornerBL) borderChars[idx] = BOX_CHARS.bottomLeft;
                            else if (isCornerBR) borderChars[idx] = BOX_CHARS.bottomRight;
                            else if (onTop || onBottom) borderChars[idx] = BOX_CHARS.horizontal;
                            else borderChars[idx] = BOX_CHARS.vertical;
                        }
                    }
                }
            }

            cache.cols = currentCols;
            cache.rows = currentRows;
            cache.cellTypes = cellTypes;
            cache.borderChars = borderChars;
            return cache;
        };

        // Get distance to nearest card edge for pooling effect
        const getPoolingFactor = (posX, posY, cards) => {
            let minDistSq = Infinity;

            for (const card of cards) {
                // Quick bounding box check
                const expandedLeft = card.x - 80;
                const expandedRight = card.right + 80;
                const expandedTop = card.y - 80;
                const expandedBottom = card.bottom + 80;

                if (posX < expandedLeft || posX > expandedRight ||
                    posY < expandedTop || posY > expandedBottom) {
                    continue;
                }

                // Check horizontal edges
                if (posX >= card.x - charWidth && posX <= card.right + charWidth) {
                    if (posY < card.y) {
                        const d = card.y - posY;
                        minDistSq = Math.min(minDistSq, d * d);
                    } else if (posY > card.bottom) {
                        const d = posY - card.bottom;
                        minDistSq = Math.min(minDistSq, d * d);
                    }
                }

                // Check vertical edges
                if (posY >= card.y - charHeight && posY <= card.bottom + charHeight) {
                    if (posX < card.x) {
                        const d = card.x - posX;
                        minDistSq = Math.min(minDistSq, d * d);
                    } else if (posX > card.right) {
                        const d = posX - card.right;
                        minDistSq = Math.min(minDistSq, d * d);
                    }
                }
            }

            if (minDistSq < 6400) { // 80^2
                return 1 - Math.sqrt(minDistSq) / 80;
            }
            return 0;
        };

        let lastFrameTime = 0;
        const targetFPS = 30;
        const frameInterval = 1000 / targetFPS;

        const animate = (timestamp) => {
            animationRef.current = requestAnimationFrame(animate);

            const delta = timestamp - lastFrameTime;
            if (delta < frameInterval) return;
            lastFrameTime = timestamp - (delta % frameInterval);

            // Update card bounds periodically
            if (cardRegistry && timestamp % 500 < 20) {
                const newBounds = cardRegistry.getCardBounds();
                if (newBounds.length !== cardBoundsRef.current.length) {
                    cardCellCacheRef.current = { cols: 0, rows: 0, borderCells: null, insideCells: null };
                }
                cardBoundsRef.current = newBounds;
            }
            const cards = cardBoundsRef.current;

            // Build/update cell cache
            const cellCache = cards.length > 0 ? buildCardCellCache(cards, cols, rows) : null;

            // Get theme colors (cached, updated on theme change)
            const theme = getThemeColors();
            const { colorCache, bgColor, borderColor, innerColor } = theme;

            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const mouseHistory = mouseHistoryRef.current;
            const historyLen = mouseHistory.length;
            const now = timestamp;

            // Pre-filter active waves (avoid checking age in inner loop)
            const activeWaves = [];
            for (let i = Math.max(0, historyLen - 20); i < historyLen; i++) {
                const point = mouseHistory[i];
                const age = (now - point.time) * 0.001;
                if (age <= 1.5) {
                    const waveRadius = age * 350;
                    activeWaves.push({
                        x: point.x,
                        y: point.y,
                        age,
                        strength: point.strength,
                        waveRadius,
                        waveRadiusSq: waveRadius * waveRadius,
                        fadeout: 1 - age / 1.5,
                    });
                }
            }
            const numWaves = activeWaves.length;

            // Batch rendering by collecting characters to draw
            // We'll still draw individually but skip unnecessary calculations
            for (let y = 0; y < rows; y++) {
                const rowIdx = y * cols;
                const posY = (y * charHeight) | 0;

                for (let x = 0; x < cols; x++) {
                    const idx = rowIdx + x;
                    const posX = (x * charWidth) | 0;

                    // Check cell cache for card-related cells
                    if (cellCache) {
                        const cellType = cellCache.cellTypes[idx];

                        if (cellType === 1) {
                            // Inside card - dim noise
                            const innerNoise = noise(x * 2, y * 2, timestamp * 0.3);
                            const dimValue = innerNoise * 0.15;
                            const charIndex = (dimValue * 3) | 0;
                            ctx.fillStyle = innerColor;
                            ctx.fillText(ASCII_CHARS[charIndex], posX, posY);
                            continue;
                        }

                        if (cellType === 2) {
                            // Border cell - check if this card is hovered
                            const hoveredIndex = cardRegistry ? cardRegistry.getHoveredCardIndex() : -1;
                            let isHovered = false;

                            // Check if this border cell belongs to a hovered card
                            if (hoveredIndex >= 0 && hoveredIndex < cards.length) {
                                const hoveredCard = cards[hoveredIndex];
                                // Check if this cell is on the border of the hovered card
                                const onHoveredTop = posY >= hoveredCard.y - charHeight && posY < hoveredCard.y + charHeight && posX >= hoveredCard.x - charWidth && posX <= hoveredCard.right + charWidth;
                                const onHoveredBottom = posY >= hoveredCard.bottom - charHeight && posY <= hoveredCard.bottom + charHeight && posX >= hoveredCard.x - charWidth && posX <= hoveredCard.right + charWidth;
                                const onHoveredLeft = posX >= hoveredCard.x - charWidth && posX < hoveredCard.x + charWidth && posY >= hoveredCard.y && posY <= hoveredCard.bottom;
                                const onHoveredRight = posX >= hoveredCard.right - charWidth && posX <= hoveredCard.right + charWidth && posY >= hoveredCard.y && posY <= hoveredCard.bottom;
                                isHovered = onHoveredTop || onHoveredBottom || onHoveredLeft || onHoveredRight;
                            }

                            if (isHovered) {
                                const isDark = document.documentElement.classList.contains('dark');
                                if (isDark) {
                                    // Muted green glow for dark mode
                                    ctx.fillStyle = 'rgba(120, 180, 120, 0.9)';
                                } else {
                                    // Warm brown glow for light mode
                                    ctx.fillStyle = 'rgba(180, 130, 80, 0.9)';
                                }
                            } else {
                                ctx.fillStyle = borderColor;
                            }
                            ctx.fillText(cellCache.borderChars[idx], posX, posY);
                            continue;
                        }
                    }

                    // Normal background cell
                    let waveInfluence = 0;

                    // Calculate wave influence using squared distances
                    for (let w = 0; w < numWaves; w++) {
                        const wave = activeWaves[w];
                        const dx = posX - wave.x;
                        const dy = posY - wave.y;
                        const distSq = dx * dx + dy * dy;

                        if (distSq > WAVE_MAX_DIST_SQ) continue;

                        // Approximate ring detection without sqrt
                        // We want to know if we're within WAVE_RING_WIDTH of waveRadius
                        // |sqrt(distSq) - waveRadius| < WAVE_RING_WIDTH
                        // This is equivalent to checking if distSq is between (waveRadius-60)^2 and (waveRadius+60)^2
                        const innerRadiusSq = Math.max(0, wave.waveRadius - WAVE_RING_WIDTH);
                        const outerRadiusSq = wave.waveRadius + WAVE_RING_WIDTH;

                        if (distSq >= innerRadiusSq * innerRadiusSq && distSq <= outerRadiusSq * outerRadiusSq) {
                            // Approximate the wave strength based on how close to the ring center
                            // Using sqrt only when we know we're in the ring (much fewer calls)
                            const dist = Math.sqrt(distSq);
                            const distFromWave = Math.abs(dist - wave.waveRadius);
                            const waveStrength = (1 - distFromWave / WAVE_RING_WIDTH) * wave.fadeout;
                            waveInfluence += waveStrength * wave.strength * 0.5;
                        }
                    }

                    // Pooling effect near card edges
                    let poolingBoost = 0;
                    if (cards.length > 0 && waveInfluence > 0.1) {
                        const proximityFactor = getPoolingFactor(posX, posY, cards);
                        if (proximityFactor > 0) {
                            poolingBoost = waveInfluence * proximityFactor * 1.5;
                        }
                    }

                    const offset = offsets[idx];
                    let noiseValue = noise(x, y, timestamp);
                    noiseValue += Math.sin(timestamp * 0.002 + offset) * 0.12;
                    noiseValue = Math.max(0, Math.min(1, noiseValue));

                    const combinedValue = Math.min(1, noiseValue * 0.5 + waveInfluence + poolingBoost);
                    const charIndex = (combinedValue * (ASCII_CHARS.length - 1)) | 0;

                    ctx.fillStyle = getColor(combinedValue, colorCache);
                    ctx.fillText(ASCII_CHARS[charIndex], posX, posY);
                }
            }

            // Cleanup old waves periodically
            if (timestamp % 500 < 20) {
                mouseHistoryRef.current = mouseHistory.filter(
                    p => timestamp - p.time < 1500
                );
            }
        };

        let lastMousePos = { x: -1000, y: -1000 };
        let lastAddTime = 0;

        const handleMouseMove = (e) => {
            const now = performance.now();
            if (now - lastAddTime < 50) return;

            const dx = e.clientX - lastMousePos.x;
            const dy = e.clientY - lastMousePos.y;
            const speedSq = dx * dx + dy * dy; // Avoid sqrt
            const strength = Math.min(1, Math.sqrt(speedSq) / 40);

            if (strength > 0.15) {
                mouseHistoryRef.current.push({
                    x: e.clientX,
                    y: e.clientY,
                    time: now,
                    strength,
                });
            }

            lastAddTime = now;
            lastMousePos = { x: e.clientX, y: e.clientY };
        };

        const handleScroll = () => {
            if (cardRegistry) {
                cardBoundsRef.current = cardRegistry.getCardBounds();
                // Invalidate cell cache on scroll
                cardCellCacheRef.current = { cols: 0, rows: 0, borderCells: null, insideCells: null };
            }
        };

        window.addEventListener('resize', resize);
        window.addEventListener('mousemove', handleMouseMove, { passive: true });
        window.addEventListener('scroll', handleScroll, { passive: true });

        resize();
        animationRef.current = requestAnimationFrame(animate);

        return () => {
            window.removeEventListener('resize', resize);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('scroll', handleScroll);
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [cardRegistry]);

    return (
        <div className="interactable-background">
            <canvas ref={canvasRef} className="background-canvas" />
        </div>
    );
}
