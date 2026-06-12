import { Badge } from '@/components/common/Badge';
import { priorityColour, priorityLabel } from '@/utils/colorUtils';
import type { Priority } from '@/types';

export function PriorityBadge({ priority }: { priority: Priority }) {
  const c = priorityColour[priority];
  return (
    <Badge className={`${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {priorityLabel[priority]}
    </Badge>
  );
}
