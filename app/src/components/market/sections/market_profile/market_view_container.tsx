import React from 'react'

import { useConnectedWeb3Context } from '../../../../contexts/connectedWeb3'
import { MarketMakerData } from '../../../../util/types'

import { MarketView } from './market_view'

interface Props {
  marketMakerData: MarketMakerData
  fetchGraphMarketMakerData: () => Promise<void>
}

const MarketViewContainer: React.FC<Props> = (props: Props) => {
  const context = useConnectedWeb3Context()

  return <MarketView account={context.account} {...props} />
}

export { MarketViewContainer }
