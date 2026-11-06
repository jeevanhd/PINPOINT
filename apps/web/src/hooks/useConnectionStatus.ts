import { useEffect, useState } from 'react';
import { getStatus, subscribeStatus, type ConnectionStatus } from '../lib/socket';

export function useConnectionStatus(): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>(getStatus());
  useEffect(() => subscribeStatus(setStatus), []);
  return status;
}
