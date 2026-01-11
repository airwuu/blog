import type { ReactNode } from 'react';
import { CardRegistryProvider } from './port/CardRegistry';
import InteractableBackground from './port/InteractableBackground';

interface BackgroundWrapperProps {
    children: ReactNode;
}

export default function BackgroundWrapper({ children }: BackgroundWrapperProps) {
    return (
        <CardRegistryProvider>
            <InteractableBackground />
            {children}
        </CardRegistryProvider>
    );
}
