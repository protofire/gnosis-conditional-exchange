import React from 'react'
import { RouteComponentProps, withRouter } from 'react-router-dom'

import { MarketMakerData } from '../../../../util/types'
import { HistoryChartContainer } from '../../common/history_chart'

interface Props extends RouteComponentProps<any> {
  marketMakerData: MarketMakerData
}

const MarketHistoryWrapper: React.FC<Props> = (props: Props) => {
  const { marketMakerData } = props
  const { address: marketMakerAddress, answerFinalizedTimestamp, question } = marketMakerData

  return (
    <>
      <HistoryChartContainer
        answerFinalizedTimestamp={answerFinalizedTimestamp}
        hidden={false}
        marketMakerAddress={marketMakerAddress}
        outcomes={question.outcomes}
      />
    </>
  )
}

export const MarketHistory = withRouter(MarketHistoryWrapper)
