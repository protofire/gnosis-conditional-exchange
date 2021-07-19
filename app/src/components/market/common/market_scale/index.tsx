import { Zero } from 'ethers/constants'
import { BigNumber } from 'ethers/utils'
import React, { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'

import { STANDARD_DECIMALS } from '../../../../common/constants'
import { useConnectedWeb3Context } from '../../../../hooks'
import { getNativeAsset } from '../../../../util/networks'
import {
  bigNumberToNumber,
  bigNumberToString,
  calcPrediction,
  calcXValue,
  formatNumber,
  getInitialCollateral,
  isDust,
} from '../../../../util/tools'
import {
  AdditionalSharesType,
  BalanceItem,
  INVALID_ANSWER_ID,
  LiquidityObject,
  LiquidityType,
  MarketDetailsTab,
  Status,
  Token,
  TradeObject,
  TradeType,
} from '../../../../util/types'
import { IconDraggable } from '../../../common/icons'
import { SCALE_HEIGHT } from '../common_styled'
import { PositionTable } from '../position_table'

import { ValueBoxes } from './value_boxes'

const BAR_WIDTH = '2px'
const BALL_SIZE = '20px'
const DOT_SIZE = '8px'

const ScaleWrapper = styled.div<{
  borderBottom: boolean | undefined
  borderTop: boolean | undefined
  valueBoxes: boolean | undefined
  compressed: boolean | undefined
}>`
  display: flex;
  flex-direction: column;
  height: 174px;
  border-bottom: ${props => (!props.borderBottom ? 'none' : `1px solid ${props.theme.scale.bar}`)};
  margin-left: -25px;
  margin-right: -25px;
  padding-left: 25px;
  padding-right: 25px;
  position: relative;
  ${props => props.borderTop && `border-top: 1px solid ${props.theme.scale.border}; padding-top: 24px; height: 202px;`};
  ${props => props.compressed && 'height: auto; padding-bottom: 24px;'}

  @media (max-width: ${props => props.theme.themeBreakPoints.md}) {
    ${props => props.valueBoxes && 'padding-bottom: 24px; height: 278px;'}
  }
`

const ScaleTitleWrapper = styled.div`
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  margin-top: 5px;
  margin-bottom: 18px;
`

const ScaleTitle = styled.p`
  font-size: 14px;
  color: ${props => props.theme.colors.textColor};
  margin: 0;
`

const Scale = styled.div`
  position: relative;
  height: ${SCALE_HEIGHT};
  width: 100%;
`

const VerticalBar = styled.div<{ position: number; positive: Maybe<boolean> }>`
  position: absolute;
  top: 0;
  bottom: 0;
  width: ${BAR_WIDTH};
  height: ${SCALE_HEIGHT};

  ${props => (props.position === 0 ? 'left: 0;' : props.position === 1 ? 'left: calc(50% - 1px);' : 'right: 0;')}
  background: ${props =>
    props.positive
      ? `${props.theme.scale.positive}`
      : props.positive === null
      ? `${props.theme.scale.bar}`
      : `${props.theme.scale.negative}`};
`

const HorizontalBar = styled.div`
  position: absolute;
  top: calc(50% - ${BAR_WIDTH} / 2);
  left: 0;
  right: 0;
  width: 100%
  height: ${BAR_WIDTH};
  background: ${props => props.theme.scale.bar};
`

const HorizontalBarLeft = styled.div<{ positive: boolean | null; width: number }>`
  position: absolute;
  top: calc(50% - ${BAR_WIDTH} / 2);
  left: 0;
  width: ${props => props.width * 100}%;
  background: ${props => (props.positive ? `${props.theme.scale.positive}` : `${props.theme.scale.negative}`)};
  height: ${BAR_WIDTH};
  z-index: 2;
`

const HorizontalBarRight = styled.div<{ positive: boolean | null; width: number }>`
  position: absolute;
  top: calc(50% - ${BAR_WIDTH} / 2);
  right: 0;
  width: ${props => props.width * 100}%;
  background: ${props => (props.positive ? `${props.theme.scale.positive}` : `${props.theme.scale.negative}`)};
  height: ${BAR_WIDTH};
  z-index: 2;
`

const HorizontalBarChange = styled.div<{ start: number; width: number }>`
  position: absolute;
  top: calc(50% - ${BAR_WIDTH} / 2);
  left: ${props => props.start * 100}%;
  width: ${props => props.width * 100}%;
  background: ${props => props.theme.scale.neutral};
  height: ${BAR_WIDTH};
  z-index: 2;
`

const ScaleBallContainer = styled.div`
  width: 100%;
`

const ScaleBall = styled.div<{ xValue: number }>`
  height: ${BALL_SIZE};
  width: ${BALL_SIZE};
  position: absolute;
  z-index: 4;
  left: calc(${props => props.xValue}% - ${BALL_SIZE} / 2);
  display: flex;
  align-items: center;
  justify-content: center;
`

const ScaleSlider = styled.input`
  height: ${SCALE_HEIGHT};
  width: calc(100% + ${BALL_SIZE});
  background: none;
  outline: none;
  -webkit-appearance: none;
  z-index: 5;
  position: absolute;
  left: calc(-${BALL_SIZE} / 2);
  right: calc(-${BALL_SIZE} / 2);

  &::-webkit-slider-thumb {
    appearance: none;
    height: ${BALL_SIZE};
    width: ${BALL_SIZE};
    border-radius: 50%;
    cursor: pointer;
  }

  &::-moz-range-thumb {
    height: ${BALL_SIZE};
    width: ${BALL_SIZE};
    border-radius: 50%;
    cursor: pointer;
  }
`

const ScaleDot = styled.div<{ xValue: number; positive?: Maybe<boolean> }>`
  position: absolute;
  height: ${DOT_SIZE};
  width: ${DOT_SIZE};
  background: ${props =>
    props.positive
      ? `${props.theme.scale.positive}`
      : props.positive === false
      ? `${props.theme.scale.negative}`
      : `${props.theme.scale.neutral}`};
  border-radius: 50%;
  z-index: 3;
  left: ${props => props.xValue * 100}%;
  transform: translateX(-50%);
  margin-top: calc((${SCALE_HEIGHT} - ${DOT_SIZE}) / 2);
`

const ScaleTooltip = styled.div<{ static: boolean | undefined; xValue: number }>`
  position: absolute;
  padding: 5px 8px;
  top: -42px;
  left: ${({ xValue }) => xValue}%;
  transform: translateX(-50%);
  background-color: ${({ theme }) => theme.colors.mainBodyBackground};
  border-radius: ${props => (props.static ? '4px' : props.theme.borders.commonBorderRadius)};
  box-shadow: ${props => (props.static ? '' : '0px 0px 4px rgba(0, 0, 0, 0.05)')};
  border: 1px solid ${props => (props.static ? props.theme.borders.borderDisabled : props.theme.borders.tooltip)};
  white-space: nowrap;
  opacity: 0;
  transition: 0.2s opacity;
  ${props => props.static && 'opacity: 1;'}
  color: ${props => (props.static ? props.theme.colors.textColorDark : props.theme.colors.black)};
`

const ScaleTooltipMessage = styled.p`
  font-size: ${({ theme }) => theme.fonts.defaultSize};
  font-style: normal;
  font-weight: 500;
  line-height: 20px;
  letter-spacing: 0.1px;
  text-align: left;
  margin: 0;
`

interface Props {
  amountShares?: Maybe<BigNumber>
  lowerBound: BigNumber
  startingPoint?: Maybe<BigNumber>
  unit: string
  currentAnswer?: string
  upperBound: BigNumber
  startingPointTitle: string
  currentPrediction?: Maybe<string>
  borderTop?: boolean
  newPrediction?: Maybe<number>
  long?: Maybe<boolean>
  short?: Maybe<boolean>
  collateral?: Maybe<Token>
  tradeAmount?: Maybe<BigNumber>
  positionTable?: Maybe<boolean>
  trades?: Maybe<TradeObject[]>
  liquidityTxs?: Maybe<LiquidityObject[]>
  status?: Maybe<Status>
  balances?: Maybe<BalanceItem[]>
  fee?: Maybe<BigNumber>
  liquidityAmount?: Maybe<BigNumber>
  additionalShares?: Maybe<number>
  additionalSharesType?: Maybe<AdditionalSharesType>
  currentTab?: MarketDetailsTab
  isBonded?: boolean
  currentAnswerBond?: Maybe<BigNumber>
  isClosed?: boolean
  outcomePredictedByMarket?: Maybe<string>
}

export const MarketScale: React.FC<Props> = (props: Props) => {
  const {
    additionalShares,
    additionalSharesType,
    amountShares,
    balances,
    borderTop,
    currentAnswer,
    currentAnswerBond,
    currentPrediction,
    currentTab,
    fee,
    isBonded,
    isClosed,
    liquidityAmount,
    liquidityTxs,
    long,
    lowerBound,
    newPrediction,
    outcomePredictedByMarket,
    positionTable,
    short,
    startingPoint,
    startingPointTitle,
    status,
    tradeAmount,
    trades,
    unit,
    upperBound,
  } = props
  const { networkId, relay } = useConnectedWeb3Context()
  const { decimals: NativeDecimals, symbol: NativeSymbol } = getNativeAsset(networkId, relay)

  const collateral = props.collateral ? getInitialCollateral(networkId, props.collateral, relay) : null
  const lowerBoundNumber = lowerBound && bigNumberToNumber(lowerBound, STANDARD_DECIMALS)
  const upperBoundNumber = upperBound && bigNumberToNumber(upperBound, STANDARD_DECIMALS)

  const startingPointNumber = startingPoint && bigNumberToNumber(startingPoint || new BigNumber(0), STANDARD_DECIMALS)

  const currentPredictionNumber = calcPrediction(currentPrediction || '', lowerBound, upperBound)
  const newPredictionNumber = calcPrediction(newPrediction?.toString() || '', lowerBound, upperBound)
  const marketPredictionNumber = calcPrediction(outcomePredictedByMarket || '', lowerBound, upperBound)

  const amountSharesNumber = collateral && bigNumberToNumber(amountShares || new BigNumber(0), collateral.decimals)

  const tradeAmountNumber = collateral && bigNumberToNumber(tradeAmount || new BigNumber(0), collateral.decimals)
  const feeNumber = fee && collateral && bigNumberToNumber(fee, collateral.decimals)

  const shortBalances = balances && balances.filter(balance => balance.outcomeName === 'short')
  const shortShares =
    shortBalances &&
    shortBalances.length &&
    shortBalances.map(shortBalance => shortBalance.shares).reduce((a, b) => a.add(b))

  const longBalances = balances && balances.filter(balance => balance.outcomeName === 'long')
  const longShares =
    longBalances &&
    longBalances.length &&
    longBalances.map(longBalance => longBalance.shares).reduce((a, b) => a.add(b))

  const shortSharesNumber = collateral && bigNumberToNumber(shortShares || new BigNumber(0), collateral.decimals)
  const longSharesNumber = collateral && bigNumberToNumber(longShares || new BigNumber(0), collateral.decimals)

  const [isAmountInputted, setIsAmountInputted] = useState(false)

  const initialMount = useRef(true)
  useEffect(() => {
    if (initialMount.current) {
      initialMount.current = false
      return
    }
    setIsAmountInputted(newPrediction ? newPrediction !== Number(currentPrediction) : false)
  }, [newPrediction, currentPrediction])

  const [scaleValue, setScaleValue] = useState<number>(
    newPrediction
      ? newPrediction * 100
      : currentPrediction
      ? Number(currentPrediction) * 100
      : calcXValue(startingPoint || new BigNumber(0), lowerBound, upperBound),
  )
  const [scaleValuePrediction, setScaleValuePrediction] = useState(currentPredictionNumber || newPredictionNumber)
  const [yourPayout, setYourPayout] = useState(0)
  const [profitLoss, setProfitLoss] = useState(0)
  const [shortPayout, setShortPayout] = useState(0)
  const [longPayout, setLongPayout] = useState(0)
  const [totalShortPrice, setTotalShortPrice] = useState<BigNumber>(new BigNumber(0))
  const [totalLongPrice, setTotalLongPrice] = useState<BigNumber>(new BigNumber(0))
  const [shortProfitAmount, setShortProfitAmount] = useState(0)
  const [longProfitAmount, setLongProfitAmount] = useState(0)
  const [longProfitPercentage, setLongProfitPercentage] = useState(0)
  const [shortProfitPercentage, setShortProfitPercentage] = useState(0)

  useEffect(() => {
    let totalShortTradesCost = new BigNumber(0)
    let totalLongTradesCost = new BigNumber(0)

    if (trades && trades.length && collateral) {
      const shortTrades = trades.filter(trade => trade.outcomeIndex === '0')
      totalShortTradesCost = shortTrades.length
        ? shortTrades
            .map(trade => (trade.type === TradeType.buy ? trade.collateralAmount : Zero.sub(trade.collateralAmount)))
            .reduce((a, b) => a.add(b))
        : new BigNumber(0)

      const longTrades = trades.filter(trade => trade.outcomeIndex === '1')
      totalLongTradesCost = longTrades.length
        ? longTrades
            .map(trade => (trade.type === TradeType.buy ? trade.collateralAmount : Zero.sub(trade.collateralAmount)))
            .reduce((a, b) => a.add(b))
        : new BigNumber(0)
    }

    let totalShortLiquidityTxsCost = new BigNumber(0)
    let totalLongLiquidityTxsCost = new BigNumber(0)
    if (liquidityTxs && liquidityTxs.length) {
      const addLiquidityTxs = liquidityTxs.filter(tx => tx.type === LiquidityType.add)
      const removeLiquidityTxs = liquidityTxs.filter(tx => tx.type === LiquidityType.remove)

      // More short shares provided so short shares are purchased
      const addLiquidityShortPurchaseTxs = addLiquidityTxs.filter(tx =>
        tx.outcomeTokenAmounts[0].lt(tx.outcomeTokenAmounts[1]),
      )
      // More long shares are removed so short shares are purchased
      const shortAdditionalSharesCosts = addLiquidityShortPurchaseTxs
        .concat(removeLiquidityTxs.filter(tx => tx.outcomeTokenAmounts[0].gt(tx.outcomeTokenAmounts[1])))
        .map(tx => tx.additionalSharesCost)

      if (shortAdditionalSharesCosts.length) {
        totalShortLiquidityTxsCost = shortAdditionalSharesCosts.reduce((a, b) => a.add(b))
      }

      // More long shares provided so long shares are purchased
      const addLiquidityLongPurchaseTxs = addLiquidityTxs.filter(tx =>
        tx.outcomeTokenAmounts[0].gt(tx.outcomeTokenAmounts[1]),
      )
      // More short shares are removed so long shares are purchased
      const longAdditionalSharesCosts = addLiquidityLongPurchaseTxs
        .concat(removeLiquidityTxs.filter(tx => tx.outcomeTokenAmounts[0].lt(tx.outcomeTokenAmounts[1])))
        .map(tx => tx.additionalSharesCost)

      if (longAdditionalSharesCosts.length) {
        totalLongLiquidityTxsCost = longAdditionalSharesCosts.reduce((a, b) => a.add(b))
      }
    }

    setTotalShortPrice(totalShortTradesCost.add(totalShortLiquidityTxsCost))
    setTotalLongPrice(totalLongTradesCost.add(totalLongLiquidityTxsCost))
    // eslint-disable-next-line
  }, [trades, props.collateral, liquidityTxs])

  const scaleBall: Maybe<HTMLInputElement> = document.querySelector('.scale-ball')
  const handleScaleBallChange = () => {
    setScaleValue(Number(scaleBall?.value))
    setScaleValuePrediction(calcPrediction((Number(scaleBall?.value) / 100).toString(), lowerBound, upperBound))
  }
  useEffect(() => {
    setScaleValue(
      newPrediction
        ? newPrediction * 100 > 100
          ? 100
          : newPrediction * 100 < 0
          ? 0
          : newPrediction * 100
        : currentPrediction
        ? Number(currentPrediction) * 100 > 100
          ? 100
          : Number(currentPrediction) * 100 < 0
          ? 0
          : Number(currentPrediction) * 100
        : calcXValue(startingPoint || new BigNumber(0), lowerBound, upperBound),
    )
    setScaleValuePrediction(
      calcPrediction(newPrediction?.toString() || currentPrediction?.toString() || '', lowerBound, upperBound),
    )
  }, [
    newPrediction,
    currentPrediction,
    lowerBoundNumber,
    startingPoint,
    startingPointNumber,
    upperBoundNumber,
    lowerBound,
    upperBound,
  ])

  const calcPayout = (shares: number, percentage: number) => {
    const payout = shares * (percentage / 100)
    return payout
  }

  const calcProfit = (shares: number, percentage: number, amount: number) => {
    const profit = shares * (percentage / 100) - amount
    return profit
  }

  const calcProfitPercentage = (shares: number, percentage: number, amount: number) => {
    const profitPercentage = ((shares * (percentage / 100)) / amount - 1) * 100
    profitPercentage < -100 ? -100 : profitPercentage
    return profitPercentage
  }

  useEffect(() => {
    if (long) {
      setYourPayout(calcPayout(amountSharesNumber || 0, scaleValue))
      setProfitLoss(calcProfit(amountSharesNumber || 0, scaleValue, tradeAmountNumber || 0))
    } else if (short) {
      setYourPayout(calcPayout(amountSharesNumber || 0, 100 - scaleValue))
      setProfitLoss(calcProfit(amountSharesNumber || 0, 100 - scaleValue, tradeAmountNumber || 0))
    } else {
      if (shortShares && collateral && !isDust(shortShares, collateral.decimals)) {
        const totalShortPriceNumber = bigNumberToNumber(totalShortPrice, collateral.decimals)
        setShortPayout(calcPayout(shortSharesNumber || 0, 100 - scaleValue))
        setShortProfitAmount(calcProfit(shortSharesNumber || 0, 100 - scaleValue, totalShortPriceNumber))
        setShortProfitPercentage(calcProfitPercentage(shortSharesNumber || 0, 100 - scaleValue, totalShortPriceNumber))
      }
      if (longShares && collateral && !isDust(longShares, collateral.decimals)) {
        const totalLongPriceNumber = bigNumberToNumber(totalLongPrice, collateral.decimals)
        setLongPayout(calcPayout(longSharesNumber || 0, scaleValue))

        setLongProfitAmount(calcProfit(longSharesNumber || 0, scaleValue, totalLongPriceNumber))
        setLongProfitPercentage(calcProfitPercentage(longSharesNumber || 0, scaleValue, totalLongPriceNumber))
      }
    }
  }, [
    scaleValuePrediction,
    tradeAmountNumber,
    long,
    lowerBoundNumber,
    newPredictionNumber,
    upperBoundNumber,
    feeNumber,
    longShares,
    longSharesNumber,
    scaleValue,
    short,
    shortShares,
    shortSharesNumber,
    totalLongPrice,
    totalShortPrice,
    amountSharesNumber,
    collateral,
    longPayout,
    shortPayout,
  ])

  const activateTooltip = () => {
    const scaleTooltip: HTMLElement | null = document.querySelector('#scale-tooltip')
    if (scaleTooltip) {
      scaleTooltip.style.opacity = '1'
    }
  }

  const deactivateTooltip = () => {
    const scaleTooltip: HTMLElement | null = document.querySelector('#scale-tooltip')
    if (scaleTooltip && currentTab !== MarketDetailsTab.sell) {
      scaleTooltip.style.opacity = '0'
    }
  }

  const isSliderEnabled =
    isAmountInputted ||
    (positionTable &&
      collateral &&
      (!isDust(shortShares || new BigNumber(0), collateral.decimals) ||
        !isDust(longShares || new BigNumber(0), collateral.decimals)))

  const isPositionTableDisabled =
    !positionTable ||
    status !== Status.Ready ||
    !trades ||
    !balances ||
    !collateral ||
    (isDust(shortShares || new BigNumber(0), collateral.decimals) &&
      isDust(longShares || new BigNumber(0), collateral.decimals))

  const showSingleValueBox =
    !isAmountInputted &&
    !(additionalShares && additionalShares > 0.000001) &&
    currentTab !== MarketDetailsTab.sell &&
    currentTab !== MarketDetailsTab.finalize &&
    currentTab !== MarketDetailsTab.setOutcome

  const showLiquidityBox =
    !!liquidityAmount && liquidityAmount.gt(0) && !!additionalShares && additionalShares > 0.000001

  const singleValueBoxData = [
    {
      title: `${
        currentPrediction ? formatNumber(currentPredictionNumber.toString()) : startingPoint ? startingPointNumber : ''
      }
      ${currentPrediction || startingPoint ? ` ${unit}` : 'Unknown'}`,
      subtitle: startingPointTitle,
      xValue: currentPrediction
        ? Number(currentPrediction)
        : startingPoint && lowerBound && upperBound
        ? calcXValue(startingPoint || new BigNumber(0), lowerBound, upperBound) / 100
        : 0.01,
    },
  ]

  const bondedValueBoxData = [
    {
      title: `${
        outcomePredictedByMarket ? marketPredictionNumber.toFixed(2) : currentPredictionNumber.toFixed(2)
      } ${unit}`,
      subtitle: 'Predicted Outcome',
    },
    {
      title: currentAnswerBond ? `${bigNumberToString(currentAnswerBond, NativeDecimals)}  ${NativeSymbol}` : '-',
      subtitle: 'Bonded',
    },
    {
      title: currentAnswer
        ? currentAnswer === INVALID_ANSWER_ID
          ? 'Invalid'
          : `${bigNumberToString(new BigNumber(currentAnswer), STANDARD_DECIMALS)} ${unit}`
        : '-',
      subtitle: isBonded ? 'Pending Outcome' : 'Final Outcome',
    },
  ]

  const amountValueBoxData = [
    {
      title: `${formatNumber(currentPredictionNumber.toString())} ${unit}`,
      subtitle: 'Current Prediction',
    },
    {
      title: `${formatNumber(scaleValuePrediction.toString())} ${unit}`,
      subtitle: 'New Prediction',
    },
    {
      title: `${formatNumber(yourPayout.toString())} ${collateral && collateral.symbol}`,
      subtitle: 'Your Payout',
      tooltip: `Your payout if the market resolves at ${formatNumber(scaleValuePrediction.toString())} ${unit}`,
      positive:
        yourPayout > (tradeAmountNumber || 0) ? true : yourPayout < (tradeAmountNumber || 0) ? false : undefined,
    },
    {
      title: `${profitLoss > 0 ? '+' : ''}
      ${formatNumber(profitLoss ? profitLoss.toString() : '0')} ${collateral && collateral.symbol}`,
      subtitle: 'Profit/Loss',
      tooltip: `Your profit/loss if the market resolves at ${formatNumber(scaleValuePrediction.toString())} ${unit}`,
      positive: profitLoss > 0 ? true : profitLoss < 0 ? false : undefined,
    },
  ]

  const liquidityValueBoxData = [
    {
      title: `${formatNumber(currentPredictionNumber.toString())} ${unit}`,
      subtitle: 'Current prediction',
    },
    {
      title: `+ ${formatNumber(additionalShares ? additionalShares.toString() : '0')} Shares `,
      subtitle: `${additionalSharesType} position`,
      tooltip: `To keep the market stable, you receive additional shares for depositing and removing liquidity.`,
      ball: true,
    },
  ]

  return (
    <>
      <ScaleWrapper
        borderBottom={isPositionTableDisabled}
        borderTop={borderTop}
        compressed={currentTab === MarketDetailsTab.sell}
        valueBoxes={isAmountInputted}
      >
        <ScaleTitleWrapper>
          <ScaleTitle>
            {formatNumber(lowerBoundNumber.toString())} {unit}
          </ScaleTitle>
          <ScaleTitle>
            {formatNumber(`${upperBoundNumber / 2 + lowerBoundNumber / 2}`)}
            {` ${unit}`}
          </ScaleTitle>
          <ScaleTitle>
            {formatNumber(upperBoundNumber.toString())} {unit}
          </ScaleTitle>
        </ScaleTitleWrapper>
        <Scale>
          <ScaleBallContainer>
            <ScaleTooltip id="scale-tooltip" static={currentTab === MarketDetailsTab.sell} xValue={scaleValue || 0}>
              <ScaleTooltipMessage>{`${formatNumber(scaleValuePrediction.toString())} ${unit}`}</ScaleTooltipMessage>
            </ScaleTooltip>
            <ScaleBall xValue={scaleValue}>
              <IconDraggable />
            </ScaleBall>
            <ScaleSlider
              className="scale-ball"
              disabled={!isSliderEnabled}
              max="100"
              min="0"
              onChange={handleScaleBallChange}
              onMouseDown={activateTooltip}
              onMouseUp={deactivateTooltip}
              type="range"
              value={scaleValue}
            />
          </ScaleBallContainer>
          {positionTable && currentPrediction && (
            <>
              <ScaleDot positive={undefined} xValue={Number(currentPrediction)} />
              <HorizontalBarChange
                start={
                  Number(currentPrediction) < (scaleValue || 0) / 100
                    ? Number(currentPrediction)
                    : (scaleValue || 0) / 100
                }
                width={
                  Number(currentPrediction) < (scaleValue || 0) / 100
                    ? (scaleValue || 0) / 100 - Number(currentPrediction)
                    : Number(currentPrediction) - (scaleValue || 0) / 100
                }
              />
            </>
          )}
          {isAmountInputted && (
            <>
              <ScaleDot
                positive={
                  (long && (newPrediction || 0) <= Number(currentPrediction)) ||
                  (!long && (newPrediction || 0) >= Number(currentPrediction))
                }
                xValue={Number(currentPrediction)}
              />
              <ScaleDot positive={true} xValue={newPrediction || 0} />
            </>
          )}
          <VerticalBar position={0} positive={isAmountInputted ? !long : null} />
          <VerticalBar
            position={1}
            positive={
              isAmountInputted ? (long && (newPrediction || 0) <= 0.5) || (!long && (newPrediction || 0) >= 0.5) : null
            }
          />
          <VerticalBar position={2} positive={isAmountInputted ? !!long : null} />
          <HorizontalBar />
          {isAmountInputted && (
            <>
              <HorizontalBarLeft positive={!long || null} width={newPrediction || 0} />
              <HorizontalBarRight positive={long || null} width={1 - (newPrediction || 0)} />
            </>
          )}
          {showSingleValueBox && !isClosed && <ValueBoxes valueBoxData={singleValueBoxData} />}
        </Scale>
        {isAmountInputted && <ValueBoxes valueBoxData={amountValueBoxData} />}
        {showLiquidityBox && <ValueBoxes valueBoxData={liquidityValueBoxData} />}
        {(isBonded || isClosed) && <ValueBoxes valueBoxData={bondedValueBoxData} />}
      </ScaleWrapper>
      {!isPositionTableDisabled && balances && collateral && trades && (
        <PositionTable
          balances={balances}
          collateral={collateral}
          fee={fee}
          longPayout={longPayout}
          longProfitLoss={longProfitAmount}
          longProfitLossPercentage={longProfitPercentage}
          shortPayout={shortPayout}
          shortProfitLoss={shortProfitAmount}
          shortProfitLossPercentage={shortProfitPercentage}
        />
      )}
    </>
  )
}
