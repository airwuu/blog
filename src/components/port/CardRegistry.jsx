import { createContext, useContext, useRef, useCallback, useEffect } from 'react';

// Context for card registration
const CardRegistryContext = createContext(null);

// Provider component
export function CardRegistryProvider({ children }) {
    const cardsRef = useRef(new Map());
    const listenersRef = useRef(new Set());

    const registerCard = useCallback((id, element) => {
        if (element) {
            cardsRef.current.set(id, element);
        } else {
            cardsRef.current.delete(id);
        }
        // Notify listeners of change
        listenersRef.current.forEach(listener => listener());
    }, []);

    const getCardBounds = useCallback(() => {
        const bounds = [];
        cardsRef.current.forEach((element) => {
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
    }, []);

    const subscribe = useCallback((listener) => {
        listenersRef.current.add(listener);
        return () => listenersRef.current.delete(listener);
    }, []);

    const value = {
        registerCard,
        getCardBounds,
        subscribe,
    };

    return (
        <CardRegistryContext.Provider value={value}>
            {children}
        </CardRegistryContext.Provider>
    );
}

// Hook for background to access card positions
export function useCardRegistry() {
    return useContext(CardRegistryContext);
}

// Hook for cards to register themselves
export function useRegisterCard(id) {
    const registry = useContext(CardRegistryContext);
    const ref = useRef(null);

    useEffect(() => {
        if (registry && ref.current) {
            registry.registerCard(id, ref.current);
            return () => registry.registerCard(id, null);
        }
    }, [registry, id]);

    return ref;
}
