import { useEffect, useState } from 'react'

import { CPKService } from '../services'
import { createCPK } from '../util/cpk'

/**
 * Returns an instance of CPKService. While the instance is being (asynchronously) created, the returned value is null.
 */

export const useCpk = (context: any) => {
  const [cpk, setCpk] = useState<Maybe<CPKService>>(null)
  useEffect(() => {
    let active = true

    const makeCpk = async () => {
      try {
        if (context) {
          const { account, library, relay } = context
          if (account && library) {
            const cpk = await createCPK(library, relay)
            const service = new CPKService(cpk, library, context)
            if (active) {
              setCpk(service)
            }
          }
        }
        // eslint-disable-next-line
      } catch {}
    }

    makeCpk()

    return () => {
      active = false
    }
  }, [context])

  return cpk
}
