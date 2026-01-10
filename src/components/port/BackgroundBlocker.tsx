import { useRegisterCard } from './CardRegistry';

let blockerIdCounter = 0;

interface BackgroundBlockerProps {
    children: React.ReactNode;
    className?: string;
    id?: string;
}

export default function BackgroundBlocker({ children, className = '', id }: BackgroundBlockerProps) {
    const blockerId = id || `bg-blocker-${++blockerIdCounter}`;
    const cardRef = useRegisterCard(blockerId);

    return (
        <div
            ref={cardRef}
            className={`relative ${className}`}
            data-tui-blocker="true"
        >
            {children}
        </div>
    );
}
