import { getNativeAsset, getWrapToken } from '../util/networks'
import { Token } from '../util/types'

import { useConnectedWeb3Context } from './connectedWeb3'

export const useSymbol = (token: Token) => {
  const { networkId, relay } = useConnectedWeb3Context()
  const wrapToken = getWrapToken(networkId)
  const nativeAsset = getNativeAsset(networkId, relay)
  if (token.address === wrapToken.address) {
    return nativeAsset.symbol
  }
  return token.symbol
}
