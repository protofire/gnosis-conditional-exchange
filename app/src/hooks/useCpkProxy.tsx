import { useCallback, useEffect, useState } from 'react'

import { useConnectedWeb3Context } from '../contexts/connectedWeb3'
import { RemoteData } from '../util/remote_data'

/**
 * Return details about a user's proxy contract
 * proxyIsUpToDate: Has the proxy implementation been upgraded to the target implementation
 */
export const useCpkProxy = () => {
  const { cpk } = useConnectedWeb3Context()

  const [proxyIsUpToDate, setUpdated] = useState<RemoteData<boolean>>(RemoteData.notAsked())

  const fetchUpdated = useCallback(async () => {
    if (cpk) {
      const updated = await cpk.proxyIsUpToDate()
      setUpdated(RemoteData.success(updated))
    }
  }, [cpk])

  const updateProxy = useCallback(async () => {
    if (cpk) {
      setUpdated(proxyIsUpToDate => RemoteData.load(proxyIsUpToDate))
      try {
        await cpk.upgradeProxyImplementation()
        setUpdated(RemoteData.success(true))
      } catch (e) {
        setUpdated(RemoteData.failure(e))
      }
    }
  }, [cpk])

  useEffect(() => {
    fetchUpdated()
  }, [cpk, fetchUpdated])

  return {
    proxyIsUpToDate,
    updateProxy,
  }
}
