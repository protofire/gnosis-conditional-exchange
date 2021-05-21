import { useEffect, useState } from 'react'

import { AirdropService } from '../services'

import { useConnectedWeb3Context } from './connectedWeb3'

export const useAirdropService = (): AirdropService => {
  const { account, library: provider, networkId, relay } = useConnectedWeb3Context()

  const [airdrop, setAirdrop] = useState<AirdropService>(new AirdropService(networkId, provider, account, relay))

  useEffect(() => {
    if (account) {
      setAirdrop(new AirdropService(networkId, provider, account, relay))
    }
    // eslint-disable-next-line
  }, [networkId, account, relay])

  return airdrop
}
