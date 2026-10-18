import React from 'react';

interface Props {
  status: string;
  className?: string;
}

export const StatusBadge: React.FC<Props> = ({ status, className = '' }) => {
  const norm = (status || '').toLowerCase().replace(/_/g, ' ');

  let colorClasses = 'bg-[#E5E7E0] text-[#73766F] border-[#D9DBD4]'; // default neutral

  switch (norm) {
    // Success / Completed / Paid / Received
    case 'paid':
    case 'fulfilled':
    case 'received':
    case 'completed':
    case 'active':
    case 'approved':
    case 'accepted':
    case 'converted':
    case 'delivered':
      colorClasses = 'bg-[#6D876D]/10 text-[#476047] border-[#6D876D]/30';
      break;

    // Warning / Pending / Partially Paid / Awaiting / Credit Hold
    case 'issued':
    case 'confirmed':
    case 'processing':
    case 'partially paid':
    case 'awaiting approval':
    case 'pending approval':
    case 'credit hold':
    case 'pending':
    case 'requested':
    case 'sent':
    case 'queued':
      colorClasses = 'bg-amber-50 text-amber-800 border-amber-200';
      break;

    // Error / Overdue / Failed / Cancelled
    case 'overdue':
    case 'cancelled':
    case 'failed':
    case 'rejected':
    case 'no show':
    case 'void':
      colorClasses = 'bg-rose-50 text-rose-800 border-rose-200';
      break;

    // Neutral / Draft
    case 'draft':
    case 'archived':
    case 'unpaid':
    case 'waived':
    default:
      colorClasses = 'bg-stone-100 text-stone-700 border-stone-200';
      break;
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border capitalize tracking-wide ${colorClasses} ${className}`}
    >
      {norm === 'pending approval' ? 'Credit Hold' : norm}
    </span>
  );
};
