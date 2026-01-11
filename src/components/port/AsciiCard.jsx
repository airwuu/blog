import { useRegisterCard } from './CardRegistry';
import './AsciiCard.css';

let cardIdCounter = 0;

export default function AsciiCard({ children, className = '', id }) {
    const cardId = id || `ascii-card-${++cardIdCounter}`;
    const cardRef = useRegisterCard(cardId);

    return (
        <div ref={cardRef} className={`ascii-card ${className}`}>
            <div className="ascii-card-content">
                {children}
            </div>
        </div>
    );
}
