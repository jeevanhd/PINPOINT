/** Re-export so tests read as documentation of the contract. */
export {
  ClientEvents,
  ServerEvents,
  dashboardUpdatedSchema,
  recallResumeSchema,
  recallStateSchema,
  serverEventSchemas,
} from '@pinpoint/shared';

import { recallResumeSchema } from '@pinpoint/shared';

export const clientToServerSchemas = {
  'recall:resume': recallResumeSchema,
} as const;
