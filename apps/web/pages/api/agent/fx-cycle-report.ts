import type { NextApiRequest, NextApiResponse } from 'next';
import {
  buildFxCycleReport,
  type FxCycleReportResponse,
} from '@/lib/server/fx-cycle-report';

export type { FxCycleReportResponse } from '@/lib/server/fx-cycle-report';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<FxCycleReportResponse | { error: string }>,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const report = await buildFxCycleReport(req.body);
    return res.status(200).json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'FX cycle report failed';
    return res.status(400).json({ error: message });
  }
}
