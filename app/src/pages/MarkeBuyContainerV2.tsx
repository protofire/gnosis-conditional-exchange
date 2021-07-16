import { Zero } from 'ethers/constants'
import { BigNumber, BigNumberish } from 'ethers/utils'
import React, { ReactFragment, useMemo, useState } from 'react'

import { STANDARD_DECIMALS } from '../common/constants'
import { MarketBuy } from '../components/market/sections/market_buy/market_buy'
import { ScalarMarketBuy } from '../components/market/sections/market_buy/scalar_market_buy'
import { useAsyncDerivedValue, useConnectedWeb3Context, useContracts } from '../hooks'
import { MarketMakerService } from '../services'
import { formatBigNumber, formatNumber, getInitialCollateral, mulBN } from '../util/tools'
import { calcPrediction, computeBalanceAfterTrade } from '../util/tools/fpmm/trading'
import { MarketDetailsTab, MarketMakerData, Token } from '../util/types'

interface Props {
  isScalar: boolean
  marketMakerData: MarketMakerData
  switchMarketTab: (arg0: MarketDetailsTab) => void
  fetchGraphMarketMakerData: () => Promise<void>
  fetchGraphMarketUserTxData: () => Promise<void>
}
export type SharedPropsInterface = {
  potentialProfit: BigNumber
  sharesTotal: string
  baseCost: BigNumber | undefined
  calcBuyAmount: any
  probabilitiesOrNewPrediction: number | number[]
  setOutcomeIndex: any
  outcomeIndex: number
  feePaid: BigNumber
  tradedShares: BigNumber
  marketMaker: MarketMakerService
  amount: BigNumber

  setAmount: any
}

const MarketBuyContainerV2: React.FC<Props> = (props: Props) => {
  const { isScalar } = props
  const context = useConnectedWeb3Context()
  const { buildMarketMaker } = useContracts(context)

  const { address: marketMakerAddress, balances, fee, scalarHigh, scalarLow } = props.marketMakerData

  const marketMaker = useMemo(() => buildMarketMaker(marketMakerAddress), [buildMarketMaker, marketMakerAddress])
  //state managment
  const [outcomeIndex, setOutcomeIndex] = useState<number>(0)
  const [newShares, setNewShares] = useState<Maybe<BigNumber[]>>(null)
  const [amount, setAmount] = useState<BigNumber>(new BigNumber(0))

  const initialCollateral = getInitialCollateral(context.networkId, props.marketMakerData.collateral, context.relay)
  const [collateral, setCollateral] = useState<Token>(initialCollateral)

  const calcBuyAmount = useMemo(
    () => async (amount: BigNumber): Promise<[BigNumber, number[] | number, BigNumber]> => {
      let tradedShares: BigNumber
      try {
        tradedShares = await marketMaker.calcBuyAmount(amount, outcomeIndex)
      } catch {
        tradedShares = new BigNumber(0)
      }
      const balanceAfterTrade = computeBalanceAfterTrade(
        balances.map(b => b.holdings),
        outcomeIndex,
        amount,
        tradedShares,
      )
      const pricesAfterTrade = MarketMakerService.getActualPrice(balanceAfterTrade)
      if (isScalar) {
        const newPrediction = calcPrediction(
          pricesAfterTrade[1].toString(),
          scalarLow || new BigNumber(0),
          scalarHigh || new BigNumber(0),
        )

        return [tradedShares, newPrediction, amount]
      } else {
        const probabilities = pricesAfterTrade.map(priceAfterTrade => priceAfterTrade * 100)
        setNewShares(
          balances.map((balance, i) => (i === outcomeIndex ? balance.shares.add(tradedShares) : balance.shares)),
        )
        return [tradedShares, probabilities, amount]
      }
    },
    [balances, marketMaker, outcomeIndex, scalarHigh, scalarLow],
  )
  const [tradedShares, probabilitiesOrNewPrediction, debouncedAmount] = useAsyncDerivedValue(
    amount || Zero,
    [new BigNumber(0), isScalar ? balances.map(() => 0) : 0, amount],
    calcBuyAmount,
  )
  const potentialProfit = tradedShares.isZero() ? new BigNumber(0) : tradedShares.sub(amount || Zero)
  const sharesTotal = formatNumber(formatBigNumber(tradedShares, collateral.decimals, collateral.decimals))
  const feePaid = mulBN(debouncedAmount || Zero, Number(formatBigNumber(fee, STANDARD_DECIMALS, 4)))
  const baseCost = debouncedAmount?.sub(feePaid)
  const sharedObject = {
    potentialProfit,
    sharesTotal,
    baseCost,
    calcBuyAmount,
    probabilitiesOrNewPrediction,
    setOutcomeIndex,
    outcomeIndex,
    feePaid,
    tradedShares,
    marketMaker,
    amount,
    setAmount,
  }
  return <>{isScalar ? <ScalarMarketBuy sharedProps={sharedObject} {...props} /> : <MarketBuy {...props} />}</>
}

export { MarketBuyContainerV2 }
