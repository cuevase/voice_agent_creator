import './ShinyText.css';
import { ReactNode } from 'react';

const ShinyText = ({ text, disabled = false, speed = 5, className = '' }: { text: ReactNode, disabled?: boolean, speed?: number, className?: string }) => {
  const animationDuration = `${speed}s`;

  return (
    <div
      className={`shiny-text ${disabled ? 'disabled' : ''} ${className}`}
      style={{ animationDuration }}
    >
      {text}
    </div>
  );
};

export default ShinyText; 