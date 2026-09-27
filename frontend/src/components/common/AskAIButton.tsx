import React from 'react';
import { Sparkles } from 'lucide-react';

interface AskAIButtonProps {
  label?: string;
  onClick: (e: React.MouseEvent) => void;
  compact?: boolean;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
  title?: string;
}

export const AskAIButton: React.FC<AskAIButtonProps> = ({
  label = 'Preguntar a la IA',
  onClick,
  compact = false,
  size = 'xs',
  className = '',
  title = 'Consultar dudas a la IA sobre lo que estás viendo',
}) => {
  const sizeClasses = {
    xs: 'px-2 py-0.5 text-[10px] gap-1',
    sm: 'px-2.5 py-1 text-xs gap-1.5',
    md: 'px-3 py-1.5 text-xs gap-1.5 font-bold',
  }[size];

  const iconSizes = {
    xs: 'w-3 h-3',
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
  }[size];

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      title={title}
      className={`inline-flex items-center rounded-md font-semibold font-mono tracking-tight transition-all
        bg-bia-turquoise/10 hover:bg-bia-turquoise/20 text-bia-turquoise border border-bia-turquoise/30
        hover:border-bia-turquoise/60 shadow-xs hover:shadow-bia-turquoise/20 active:scale-95 group ${sizeClasses} ${className}`}
    >
      <Sparkles className={`${iconSizes} text-bia-turquoise animate-pulse group-hover:rotate-12 transition-transform shrink-0`} />
      {!compact && <span>{label}</span>}
    </button>
  );
};
