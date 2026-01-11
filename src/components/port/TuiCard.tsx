import { useRegisterCard } from './CardRegistry';
import './TuiCard.css';

let cardIdCounter = 0;

interface TuiCardProps {
    children: React.ReactNode;
    className?: string;
    id?: string;
}

export default function TuiCard({ children, className = '', id, ...props }: TuiCardProps) {
    const cardId = id || `tui-card-${++cardIdCounter}`;
    // TuiCards are blockers by default (they have backgrounds/content)
    const cardRef = useRegisterCard(cardId);

    return (
        <div
            ref={cardRef}
            className={`tui-card ${className}`}
            data-tui-blocker="true"
            {...props}
        >
            <div className="tui-card-content">
                {children}
            </div>
        </div>
    );
}
