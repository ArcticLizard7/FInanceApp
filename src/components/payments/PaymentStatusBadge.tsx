import { Badge } from '@/components/common/Badge';
import { approvalStatusColour, approvalStatusLabel, paymentStatusColour, paymentStatusLabel } from '@/utils/colorUtils';
import type { PaymentApprovalStatus, PaymentStatus } from '@/types';

export function ApprovalBadge({ status }: { status: PaymentApprovalStatus }) {
  const c = approvalStatusColour[status];
  return <Badge className={`${c.bg} ${c.text}`}>{approvalStatusLabel[status]}</Badge>;
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const c = paymentStatusColour[status];
  return <Badge className={`${c.bg} ${c.text}`}>{paymentStatusLabel[status]}</Badge>;
}
