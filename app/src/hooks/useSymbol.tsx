import { useConnectedWeb3Context } from '../contexts/connectedWeb3'
import { getNativeAsset, getWrapToken } from '../util/networks'
import { Token } from '../util/types'

export const useSymbol = (token: Token) => {
  const { networkId, relay } = useConnectedWeb3Context()
  const wrapToken = getWrapToken(networkId)
  const nativeAsset = getNativeAsset(networkId, relay)
  if (token.address === wrapToken.address) {
    return nativeAsset.symbol
  }
  return token.symbol
}
