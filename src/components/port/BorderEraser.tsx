import { useRegisterCard } from './CardRegistry';

let eraserIdCounter = 0;

interface BorderEraserProps {
    className?: string;
    id?: string;
}

export default function BorderEraser({ className = '', id }: BorderEraserProps) {
    const eraserId = id || `border-eraser-${++eraserIdCounter}`;
    const cardRef = useRegisterCard(eraserId);

    return (
        <div
            ref={cardRef}
            className={`absolute z-10 ${className}`}
            data-tui-border-eraser="true"
        />
    );
}
