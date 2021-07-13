import { ethers } from 'ethers'
import { useEffect, useState } from 'react'

import { ConnectedWeb3Context } from '../contexts/connectedWeb3'
import { getInfuraUrl, networkIds } from '../util/networks'
import { isContract } from '../util/tools'

export const useCheckContractExists = (marketMakerAddress: string, context: ConnectedWeb3Context): boolean => {
  const [contractExists, setContractExists] = useState<boolean>(true)

  useEffect(() => {
    let isSubscribed = true
    const provider = context.library
    const fetchIsContract = async () => {
      const switchToMainnet = context.relay && (await isContract(context.rawWeb3Context.library, marketMakerAddress))
      const switchToxDai =
        context.networkId === networkIds.MAINNET &&
        !context.relay &&
        (await isContract(new ethers.providers.JsonRpcProvider(getInfuraUrl(networkIds.XDAI)), marketMakerAddress))
      if (switchToMainnet || switchToxDai) {
        return context.toggleRelay()
      }
      if (isSubscribed) setContractExists(await isContract(provider, marketMakerAddress))
    }

    fetchIsContract()
    return () => {
      isSubscribed = false
    }
  }, [context, marketMakerAddress])

  return contractExists
}
