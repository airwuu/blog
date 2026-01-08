// Global card registry for cross-island communication in Astro
// Uses a global store pattern instead of React context

const cardRegistry = {
    cards: new Map(),
    listeners: new Set(),
    mousePos: { x: 0, y: 0 },
    hoveredCardIndex: -1,

    register(id, element) {
        if (element) {
            this.cards.set(id, element);
        } else {
            this.cards.delete(id);
        }
        this.notifyListeners();
    },

    unregister(id) {
        this.cards.delete(id);
        this.notifyListeners();
    },

    getCardBounds() {
        const bounds = [];
        this.cards.forEach((element) => {
            const rect = element.getBoundingClientRect();
            bounds.push({
                x: rect.left,
                y: rect.top,
                right: rect.right,
                bottom: rect.bottom,
                width: rect.width,
                height: rect.height,
            });
        });
        return bounds;
    },

    updateMousePos(x, y) {
        this.mousePos = { x, y };
        // Check which card is hovered
        const bounds = this.getCardBounds();
        this.hoveredCardIndex = -1;
        for (let i = 0; i < bounds.length; i++) {
            const card = bounds[i];
            if (x >= card.x && x <= card.right && y >= card.y && y <= card.bottom) {
                this.hoveredCardIndex = i;
                break;
            }
        }
    },

    getHoveredCardIndex() {
        return this.hoveredCardIndex;
    },

    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    },

    notifyListeners() {
        this.listeners.forEach(listener => listener());
    }
};

// Make it globally accessible
if (typeof window !== 'undefined') {
    window.__cardRegistry = cardRegistry;

    // Track mouse position globally
    window.addEventListener('mousemove', (e) => {
        cardRegistry.updateMousePos(e.clientX, e.clientY);
    }, { passive: true });
}

export function getCardRegistry() {
    if (typeof window !== 'undefined' && window.__cardRegistry) {
        return window.__cardRegistry;
    }
    return cardRegistry;
}

// React hooks for convenience
import { useEffect, useRef } from 'react';

export function useCardRegistry() {
    return getCardRegistry();
}

export function useRegisterCard(id) {
    const ref = useRef(null);

    useEffect(() => {
        const registry = getCardRegistry();
        if (ref.current) {
            registry.register(id, ref.current);
            return () => registry.unregister(id);
        }
    }, [id]);

    return ref;
}

// Legacy context exports for compatibility
import { createContext, useContext } from 'react';

const CardRegistryContext = createContext(null);

export function CardRegistryProvider({ children }) {
    // Just pass through children - registry is global now
    return children;
}
