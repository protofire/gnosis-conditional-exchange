import Big from 'big.js'
import { BigNumber, bigNumberify } from 'ethers/utils'
import { useCallback, useEffect, useState } from 'react'

import { ERC20Service, MarketMakerService, OracleService } from '../services'
import { getLogger } from '../util/logger'
import { getArbitratorFromAddress } from '../util/networks'
import { isScalarMarket, promiseProps } from '../util/tools'
import { BalanceItem, MarketMakerData, Status, Token } from '../util/types'

import { useConnectedCPKContext } from './connectedCpk'
import { useConnectedWeb3Context } from './connectedWeb3'
import { useContracts } from './useContracts'
import { GraphMarketMakerData } from './useGraphMarketMakerData'

const logger = getLogger('useBlockchainMarketMakerData')

const getBalances = (
  outcomes: string[],
  marketMakerShares: BigNumber[],
  userShares: BigNumber[],
  payouts: Maybe<Big[]>,
): BalanceItem[] => {
  const actualPrices = MarketMakerService.getActualPrice(marketMakerShares)

  const balances: BalanceItem[] = outcomes.length
    ? outcomes.map((outcome: string, index: number) => {
        const outcomeName = outcome
        const probability = actualPrices[index] * 100
        const currentPrice = actualPrices[index]
        const shares = userShares[index]
        const holdings = marketMakerShares[index]

        return {
          outcomeName,
          probability,
          currentPrice,
          shares,
          holdings,
          payout: payouts ? payouts[index] : new Big(0),
        }
      })
    : []

  return balances
}

const getScalarBalances = (
  marketMakerShares: BigNumber[],
  userShares: BigNumber[],
  payouts: Maybe<Big[]>,
): BalanceItem[] => {
  const actualPrices = MarketMakerService.getActualPrice(marketMakerShares)

  const balances: BalanceItem[] = []

  for (let i = 0; i < 2; i++) {
    const outcomeName = i === 0 ? 'short' : 'long'
    const probability = actualPrices[i] * 100
    const currentPrice = actualPrices[i]
    const shares = userShares[i]
    const holdings = marketMakerShares[i]

    const balance = {
      outcomeName,
      probability,
      currentPrice,
      shares,
      holdings,
      payout: payouts ? payouts[i] : new Big(0),
    }

    balances.push(balance)
  }

  return balances
}

const getERC20Token = async (provider: any, address: string): Promise<Token> => {
  const erc20Service = new ERC20Service(provider, null, address)
  const token = await erc20Service.getProfileSummary()

  return token
}

export const useBlockchainMarketMakerData = (graphMarketMakerData: Maybe<GraphMarketMakerData>, networkId: number) => {
  const context = useConnectedWeb3Context()
  const cpk = useConnectedCPKContext()

  const { library: provider } = context
  const contracts = useContracts(context)
  const [marketMakerData, setMarketMakerData] = useState<Maybe<MarketMakerData>>(null)
  const [status, setStatus] = useState<Status>(Status.Loading)

  const doFetchData = useCallback(async () => {
    if (!graphMarketMakerData) {
      setStatus(Status.Error)
      return
    }

    const { buildMarketMaker, conditionalTokens } = contracts

    const marketMaker = buildMarketMaker(graphMarketMakerData.address)

    const { outcomes } = graphMarketMakerData.question

    const isQuestionFinalized = graphMarketMakerData.answerFinalizedTimestamp
      ? Date.now() > 1000 * graphMarketMakerData.answerFinalizedTimestamp.toNumber()
      : false

    const isScalar = isScalarMarket(graphMarketMakerData.oracle || '', networkId || 0)

    const outcomesLength = isScalar ? 2 : outcomes.length

    const {
      collateral,
      isConditionResolved,
      marketMakerFunding,
      marketMakerShares,
      marketMakerUserFunding,
      realitioAnswer,
      totalEarnings,
      totalPoolShares,
      userPoolShares,
      userShares,
    } = await promiseProps({
      marketMakerShares: marketMaker.getBalanceInformation(graphMarketMakerData.address, outcomesLength),
      userShares:
        cpk && cpk.address
          ? marketMaker.getBalanceInformation(cpk.address, outcomesLength)
          : outcomes.length
          ? outcomes.map(() => new BigNumber(0))
          : [],
      collateral: getERC20Token(provider, graphMarketMakerData.collateralAddress),
      isConditionResolved: conditionalTokens.isConditionResolved(graphMarketMakerData.conditionId),
      marketMakerFunding: marketMaker.getTotalSupply(),
      marketMakerUserFunding: cpk && cpk.address ? marketMaker.balanceOf(cpk.address) : new BigNumber(0),
      realitioAnswer: isQuestionFinalized ? contracts.realitio.getResultFor(graphMarketMakerData.question.id) : null,
      totalEarnings: marketMaker.getCollectedFees(),
      totalPoolShares: marketMaker.poolSharesTotalSupply(),
      userPoolShares: cpk && cpk.address ? marketMaker.poolSharesBalanceOf(cpk.address) : new BigNumber(0),
    })

    let userEarnings = new BigNumber(0)

    if (cpk && cpk.address && marketMakerFunding.gt(0)) {
      try {
        userEarnings = await marketMaker.getFeesWithdrawableBy(cpk.address)
      } catch {
        console.warn('Could not retrieve user earnings.')
      }
    }

    const arbitrator = getArbitratorFromAddress(networkId, graphMarketMakerData.arbitratorAddress)

    const payouts = graphMarketMakerData.payouts
      ? graphMarketMakerData.payouts
      : isScalar
      ? null
      : realitioAnswer
      ? OracleService.getPayouts(graphMarketMakerData.question.templateId, realitioAnswer, outcomesLength)
      : null

    let balances: BalanceItem[]
    isScalar
      ? (balances = getScalarBalances(marketMakerShares, userShares, payouts))
      : (balances = getBalances(outcomes, marketMakerShares, userShares, payouts))

    const newMarketMakerData: MarketMakerData = {
      address: graphMarketMakerData.address,
      answerFinalizedTimestamp: graphMarketMakerData.answerFinalizedTimestamp,
      arbitrator,
      balances,
      collateral,
      creator: graphMarketMakerData.creator,
      fee: graphMarketMakerData.fee,
      collateralVolume: graphMarketMakerData.collateralVolume,
      userInputCollateral: collateral,
      isConditionResolved,
      isQuestionFinalized,
      marketMakerFunding,
      marketMakerUserFunding,
      payouts,
      oracle: graphMarketMakerData.oracle,
      question: graphMarketMakerData.question,
      realitioAnswer: realitioAnswer ? bigNumberify(realitioAnswer) : null,
      totalEarnings,
      totalPoolShares,
      userEarnings,
      userPoolShares,
      klerosTCRregistered: graphMarketMakerData.klerosTCRregistered,
      curatedByDxDao: graphMarketMakerData.curatedByDxDao,
      curatedByDxDaoOrKleros: graphMarketMakerData.curatedByDxDaoOrKleros,
      runningDailyVolumeByHour: graphMarketMakerData.runningDailyVolumeByHour,
      lastActiveDay: graphMarketMakerData.lastActiveDay,
      creationTimestamp: graphMarketMakerData.creationTimestamp,
      scaledLiquidityParameter: graphMarketMakerData.scaledLiquidityParameter,
      submissionIDs: graphMarketMakerData.submissionIDs,
      scalarLow: graphMarketMakerData.scalarLow,
      scalarHigh: graphMarketMakerData.scalarHigh,
      outcomeTokenMarginalPrices: graphMarketMakerData.outcomeTokenMarginalPrices,
      outcomeTokenAmounts: graphMarketMakerData.outcomeTokenAmounts,
    }

    setMarketMakerData(newMarketMakerData)
    setStatus(Status.Ready)
  }, [graphMarketMakerData, provider, contracts, networkId, cpk])

  const fetchData = useCallback(async () => {
    try {
      setStatus(Status.Loading)
      await doFetchData()
    } catch (e) {
      logger.error(e)
      setStatus(Status.Error)
    }
  }, [doFetchData])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (marketMakerData) {
      fetchData()
    }
    // eslint-disable-next-line
  }, [graphMarketMakerData])

  return {
    fetchData,
    marketMakerData,
    status,
  }
}
