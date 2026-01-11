import { useRegisterCard } from './CardRegistry';
import './TuiCard.css';

let timelineIdCounter = 0;

interface TimelineLineProps {
    className?: string;
    id?: string;
}

export default function TimelineLine({ className = '', id }: TimelineLineProps) {
    const lineId = id || `timeline-line-${++timelineIdCounter}`;
    const lineRef = useRegisterCard(lineId);

    return (
        <div
            ref={lineRef}
            className={`timeline-line ${className}`}
            data-tui-blocker="true"
            style={{
                width: '2px',
                minHeight: '32px',
            }}
        />
    );
}
