import { BigNumber } from 'ethers/utils'
import React, { useState } from 'react'

import { LINK_FAQ } from '../../../../common/constants'
import { formatBigNumber, formatNumber, getMarketTitles } from '../../../../util/tools'
import { useGraphMarketMakerData, useConnectedWeb3Context } from '../../../../hooks'
import { MarketMakerData } from '../../../../util/types'
import { GridTwoColumns, SubsectionTitleAction, SubsectionTitleWrapper, TitleValue } from '../../../common'
import { Breaker, SubsectionTitleActionWrapper } from '../common_styled'
import { DisplayArbitrator } from '../display_arbitrator'
import { DisplayResolution } from '../display_resolution'
import { HistoryChartContainer } from '../history_chart'
import { MarketTitle } from '../market_title'
import { ProgressBar } from '../progress_bar'
import { MarketData } from '../market_data'
import { AdditionalMarketData } from '../additional_market_data'

interface Props {
  marketMakerData: MarketMakerData
  collateral: BigNumber
}

const SUB_LINK = '#heading=h.9awaoq9ub17q'

const MarketTopDetailsClosed: React.FC<Props> = (props: Props) => {
  const context = useConnectedWeb3Context()
  const { marketMakerData } = props

  const {
    address,
    answerFinalizedTimestamp,
    arbitrator,
    collateral: collateralToken,
    collateralVolume,
    question,
  } = marketMakerData
  const totalVolumeFormat = collateralVolume
    ? `${formatNumber(formatBigNumber(collateralVolume, collateralToken.decimals))} ${collateralToken.symbol}`
    : '-'

  const [showingTradeHistory, setShowingTradeHistory] = useState(false)
  const [tradeHistoryLoaded, setTradeHistoryLoaded] = useState(false)

  const toggleTradeHistory = () => {
    if (showingTradeHistory) {
      setShowingTradeHistory(false)
    } else {
      setShowingTradeHistory(true)
      // After first load on demand we maintain this value to only load the data when history is shown.
      setTradeHistoryLoaded(true)
    }
  }

  const { marketSubtitle } = getMarketTitles(question.templateId)

  const useGraphMarketMakerDataResult = useGraphMarketMakerData(address, context.networkId)
  const creationTimestamp: string = useGraphMarketMakerDataResult.marketMakerData
    ? useGraphMarketMakerDataResult.marketMakerData.creationTimestamp
    : ''
  const creationDate = new Date(1000 * parseInt(creationTimestamp))
  
  const finalizedTimestampDate = answerFinalizedTimestamp && new Date(answerFinalizedTimestamp.toNumber() * 1000)
  const isPendingArbitration = question.isPendingArbitration
  const arbitrationOccurred = question.arbitrationOccurred

  return (
    <>
      <SubsectionTitleWrapper>
        <MarketTitle templateId={question.templateId} />
        {/* <SubsectionTitleActionWrapper>
          {LINK_FAQ && (
            <SubsectionTitleActionWrapper>
              <SubsectionTitleAction
                onClick={() => {
                  window.open(`${LINK_FAQ}${SUB_LINK}`)
                }}
              >
                {marketSubtitle}
              </SubsectionTitleAction>
            </SubsectionTitleActionWrapper>
          )}
          <Breaker />
          <SubsectionTitleAction onClick={toggleTradeHistory}>
            {`${showingTradeHistory ? 'Hide' : 'Show'} Trade History`}
          </SubsectionTitleAction>
        </SubsectionTitleActionWrapper> */}
      </SubsectionTitleWrapper>
      {/* TODO: Add dynamic props */}
      <ProgressBar 
        state={'closed'} 
        creationTimestamp={creationDate} 
        resolutionTimestamp={question.resolution} 
        pendingArbitration={isPendingArbitration} 
        arbitrationOccurred={arbitrationOccurred}
        answerFinalizedTimestamp={finalizedTimestampDate}
      ></ProgressBar>
      {/* TODO: Add dynamic props */}
      <MarketData resolutionTimestamp={question.resolution} dailyVolume={collateralVolume} currency={collateralToken}></MarketData>
      <AdditionalMarketData 
        category={question.category} 
        arbitrator={arbitrator} 
        oracle='Reality.eth' 
        id={question.id}
        showingTradeHistory={showingTradeHistory}
        handleTradeHistoryClick={toggleTradeHistory}
      ></AdditionalMarketData>
      {/* <GridTwoColumns>
        <TitleValue title={'Category'} value={question.category} />
        <DisplayResolution questionId={question.id} title={'Resolution Date'} value={question.resolution} />
        <TitleValue title={'Arbitrator'} value={arbitrator && <DisplayArbitrator arbitrator={arbitrator} />} />
        <TitleValue title={'Total Volume'} value={totalVolumeFormat} />
      </GridTwoColumns> */}
      {tradeHistoryLoaded && (
        <HistoryChartContainer
          answerFinalizedTimestamp={answerFinalizedTimestamp}
          hidden={!showingTradeHistory}
          marketMakerAddress={address}
          outcomes={question.outcomes}
        />
      )}
    </>
  )
}

export { MarketTopDetailsClosed }
