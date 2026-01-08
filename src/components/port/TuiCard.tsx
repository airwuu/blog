import { useRegisterCard } from './CardRegistry';
import './TuiCard.css';

let cardIdCounter = 0;

interface TuiCardProps {
    children: React.ReactNode;
    className?: string;
    id?: string;
}

export default function TuiCard({ children, className = '', id }: TuiCardProps) {
    const cardId = id || `tui-card-${++cardIdCounter}`;
    const cardRef = useRegisterCard(cardId);

    return (
        <div ref={cardRef} className={`tui-card ${className}`}>
            <div className="tui-card-content">
                {children}
            </div>
        </div>
    );
}
