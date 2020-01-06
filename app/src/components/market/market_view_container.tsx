import React from 'react'

import { MarketView } from './market_view'
import { useConnectedWeb3Context } from '../../hooks/connectedWeb3'
import { FullLoading } from '../common/full_loading'
import { useMarketMakerData } from '../../hooks/useMarketMakerData'

interface Props {
  marketMakerAddress: string
}

const MarketViewContainer: React.FC<Props> = (props: Props) => {
  const context = useConnectedWeb3Context()

  const { marketMakerAddress } = props

  const { marketMakerData, status } = useMarketMakerData(marketMakerAddress, context)

  const {
    marketMakerFunding,
    balances,
    collateral,
    question,
    questionId,
    resolution,
    arbitrator,
    category,
    isConditionResolved,
    isQuestionFinalized,
  } = marketMakerData

  if (!collateral) {
    return <FullLoading />
  }

  return (
    <MarketView
      balances={balances}
      funding={marketMakerFunding}
      marketMakerAddress={marketMakerAddress}
      status={status}
      collateral={collateral}
      questionId={questionId}
      question={question || ''}
      category={category || ''}
      resolution={resolution}
      arbitrator={arbitrator}
      isQuestionFinalized={isQuestionFinalized}
      isConditionResolved={isConditionResolved}
    />
  )
}

export { MarketViewContainer }
