import { useConnectedWeb3Context } from '../contexts/connectedWeb3'

import { useBlockchainMarketMakerData } from './useBlockchainMarketMakerData'
import { useGraphMarketMakerData } from './useGraphMarketMakerData'

export const useMarketMakerData = (marketMakerAddress: string) => {
  const { networkId } = useConnectedWeb3Context()
  const { fetchData: fetchGraphMarketMakerData, marketMakerData: graphMarketMakerData } = useGraphMarketMakerData(
    marketMakerAddress,
    networkId,
  )
  const { fetchData, marketMakerData, status } = useBlockchainMarketMakerData(graphMarketMakerData, networkId)
  return { fetchData, marketMakerData, fetchGraphMarketMakerData, status }
}
