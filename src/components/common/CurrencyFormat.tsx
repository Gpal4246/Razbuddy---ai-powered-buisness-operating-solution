import React from 'react';

interface Props {
  amount: number;
  currency?: string;
  className?: string;
  showDecimals?: boolean;
}

export const CurrencyFormat: React.FC<Props> = ({
  amount,
  currency = '₹',
  className = '',
  showDecimals = false,
}) => {
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount || 0);

  return (
    <span className={`font-mono tabular-nums ${className}`}>
      <span className="font-sans mr-0.5">{currency}</span>{formatted}
    </span>
  );
};

export function formatInr(amount: number, showDecimals: boolean = false): string {
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount || 0);
  return `₹${formatted}`;
}
