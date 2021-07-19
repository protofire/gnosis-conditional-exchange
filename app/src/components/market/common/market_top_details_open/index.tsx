import React, { useState } from 'react'
import { useHistory } from 'react-router'
import styled from 'styled-components'

import { IMPORT_QUESTION_ID_KEY } from '../../../../common/constants'
import { useConnectedWeb3Context } from '../../../../hooks'
import { useGraphMarketsFromQuestion } from '../../../../hooks/useGraphMarketsFromQuestion'
import { useWindowDimensions } from '../../../../hooks/useWindowDimensions'
import theme from '../../../../theme'
import { getContractAddress, getNativeAsset, getWrapToken } from '../../../../util/networks'
import { getInitialCollateral, getMarketRelatedQuestionFilter, onChangeMarketCurrency } from '../../../../util/tools'
import { MarketMakerData, MarketState, Token } from '../../../../util/types'
import { SubsectionTitleWrapper } from '../../../common'
import { MoreMenu } from '../../../common/form/more_menu'
import { AdditionalMarketData } from '../additional_market_data'
import { CurrencySelector } from '../currency_selector'
import { MarketData } from '../market_data'
import { ProgressBar } from '../progress_bar'
import { ProgressBarToggle } from '../progress_bar/toggle'

const SubsectionTitleLeftWrapper = styled.div`
  display: flex;
  align-items: center;

  @media (max-width: ${props => props.theme.themeBreakPoints.sm}) {
    flex-grow: 1;
  }
  & > * + * {
    margin-left: 12px;
  }
`

const MarketCurrencySelector = styled(CurrencySelector)`
  .dropdownItems {
    min-width: auto;
  }
`

interface Props {
  marketMakerData: MarketMakerData
  title?: string
}

const MarketTopDetailsOpen: React.FC<Props> = (props: Props) => {
  const context = useConnectedWeb3Context()
  const { networkId, relay } = context
  const { width } = useWindowDimensions()
  const isMobile = width <= parseInt(theme.themeBreakPoints.sm)

  const [showingProgressBar, setShowingProgressBar] = useState(false)
  const history = useHistory()

  const { marketMakerData } = props
  const {
    address,
    answerFinalizedTimestamp,
    arbitrator,
    collateralVolume,
    creationTimestamp,
    curatedByDxDao,
    curatedByDxDaoOrKleros,
    lastActiveDay,
    question,
    runningDailyVolumeByHour,
    scaledLiquidityParameter,
    submissionIDs,
  } = marketMakerData

  const ovmAddress = getContractAddress(networkId, 'omenVerifiedMarkets')
  const creationDate = new Date(1000 * parseInt(creationTimestamp))

  const collateral = getInitialCollateral(networkId, marketMakerData.collateral, relay)

  const currentTimestamp = new Date().getTime()

  const formattedLiquidity: number = scaledLiquidityParameter ? scaledLiquidityParameter : 0

  const isPendingArbitration = question.isPendingArbitration
  const arbitrationOccurred = question.arbitrationOccurred

  const marketState =
    question.resolution.getTime() > currentTimestamp
      ? MarketState.open
      : question.resolution.getTime() < currentTimestamp &&
        (answerFinalizedTimestamp === null || answerFinalizedTimestamp.toNumber() * 1000 > currentTimestamp)
      ? MarketState.finalizing
      : isPendingArbitration
      ? MarketState.arbitration
      : answerFinalizedTimestamp && answerFinalizedTimestamp.toNumber() * 1000 < currentTimestamp
      ? MarketState.closed
      : MarketState.none

  const { markets: marketsRelatedQuestion } = useGraphMarketsFromQuestion(question.id)

  const toggleProgressBar = () => {
    setShowingProgressBar(!showingProgressBar)
  }

  const moreMenuItems = [
    {
      onClick: () => {
        localStorage.setItem(IMPORT_QUESTION_ID_KEY, question.id)
        history.push('/create')
      },
      content: 'Add Currency',
    },
    {
      onClick: () => {
        toggleProgressBar()
      },
      content: showingProgressBar ? 'Hide Market State' : 'Show Market State',
    },
  ]

  const nativeAssetAddress = getNativeAsset(networkId, relay).address.toLowerCase()
  const wrapTokenAddress = getWrapToken(networkId).address.toLowerCase()
  const filter = getMarketRelatedQuestionFilter(marketsRelatedQuestion, networkId)

  return (
    <>
      <SubsectionTitleWrapper>
        <SubsectionTitleLeftWrapper>
          {!relay && marketsRelatedQuestion.length > 1 && (
            <MarketCurrencySelector
              addNativeAsset
              context={context}
              currency={collateral.address === wrapTokenAddress ? nativeAssetAddress : collateral.address}
              disabled={false}
              filters={filter}
              onSelect={(currency: Token | null) =>
                onChangeMarketCurrency(marketsRelatedQuestion, currency, collateral, networkId, history)
              }
              placeholder=""
            />
          )}
          {(!isMobile || marketsRelatedQuestion.length === 1) && (
            <ProgressBarToggle
              active={showingProgressBar}
              state={marketState}
              templateId={question.templateId}
              toggleProgressBar={toggleProgressBar}
            ></ProgressBarToggle>
          )}
        </SubsectionTitleLeftWrapper>

        <MoreMenu items={marketsRelatedQuestion.length > 1 && isMobile ? moreMenuItems : new Array(moreMenuItems[0])} />
      </SubsectionTitleWrapper>
      {showingProgressBar && (
        <ProgressBar
          answerFinalizedTimestamp={answerFinalizedTimestamp}
          arbitrationOccurred={arbitrationOccurred}
          bondTimestamp={question.currentAnswerTimestamp}
          creationTimestamp={creationDate}
          pendingArbitration={isPendingArbitration}
          resolutionTimestamp={question.resolution}
          state={marketState}
        ></ProgressBar>
      )}
      <MarketData
        answerFinalizedTimestamp={marketMakerData.answerFinalizedTimestamp}
        collateralVolume={collateralVolume}
        currency={collateral}
        isFinalize={marketState === MarketState.finalizing}
        lastActiveDay={lastActiveDay}
        liquidity={formattedLiquidity}
        resolutionTimestamp={question.resolution}
        runningDailyVolumeByHour={runningDailyVolumeByHour}
      ></MarketData>
      <AdditionalMarketData
        address={address}
        arbitrator={arbitrator}
        category={question.category}
        collateral={collateral}
        curatedByDxDao={curatedByDxDao}
        curatedByDxDaoOrKleros={curatedByDxDaoOrKleros}
        id={question.id}
        oracle="Reality.eth"
        ovmAddress={ovmAddress}
        submissionIDs={submissionIDs}
        title={question.title}
      ></AdditionalMarketData>
    </>
  )
}

export { MarketTopDetailsOpen }
