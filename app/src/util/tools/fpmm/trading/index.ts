import { newtonRaphson } from '@fvictorio/newton-raphson-method'
import Big from 'big.js'
import { WeiPerEther, Zero } from 'ethers/constants'
import { BigNumber, bigNumberify } from 'ethers/utils'

import { STANDARD_DECIMALS } from '../../../../common/constants'
import { bigNumberToNumber } from '../../formatting'
import { ceilDiv, divBN, mulBN } from '../../maths'

/**
 * Computes the market maker's balances of outcome tokens after a trade to buy shares of a particular outcome
 * @param initialPoolBalances - the market maker's balances of outcome tokens before the trade
 * @param outcomeIndex - the index of the outcome token being bought
 * @param investmentAmountAfterFees - the amount of collateral being converted into outcome tokens (i.e. post fees)
 * @param sharesBoughtAmount - the amount of outcome tokens being removed from the market maker
 * @param fees - the percentage fees taken by the market maker on each trade
 */
export const computeBalanceAfterSharePurchase = (
  initialPoolBalances: BigNumber[],
  outcomeIndex: number,
  investmentAmount: BigNumber,
  sharesBoughtAmount: BigNumber,
  fees: number,
): BigNumber[] =>
  computeBalanceAfterTrade(
    initialPoolBalances,
    outcomeIndex,
    fees !== 1 ? mulBN(investmentAmount, 1 - fees) : Zero,
    sharesBoughtAmount,
  )

/**
 * Computes the market maker's balances of outcome tokens after a trade
 *
 * @dev It is recommended to use the methods `computeBalanceAfterSharePurchase` and `computeBalanceAfterShareSale` instead of this
 *
 * @param initialPoolBalances - the market maker's balances of outcome tokens before the trade
 * @param outcomeIndex - the index of the outcome token being bought
 * @param investmentAmountAfterFees - the amount of collateral being converted into outcome tokens (i.e. post fees)
 * @param sharesBoughtAmount - the amount of outcome tokens being removed from the market maker
 */
export const computeBalanceAfterTrade = (
  holdings: BigNumber[],
  outcomeIndex: number, // Outcome selected
  amountCollateralSpent: BigNumber, // Amount of collateral being spent
  amountShares: BigNumber, // amount of `outcome` shares being traded
): BigNumber[] => {
  if (outcomeIndex < 0 || outcomeIndex >= holdings.length) {
    throw new Error(`Outcome index '${outcomeIndex}' must be between 0 and '${holdings.length}' - 1`)
  }

  const newPoolBalances = holdings.map((h, i) => {
    return h.add(amountCollateralSpent).sub(i === outcomeIndex ? amountShares : bigNumberify(0))
  })
  if (newPoolBalances.some(balance => balance.lte(0))) {
    throw new Error(`Trade is invalid: trade results in liquidity pool owning a negative number of tokens`)
  }
  return newPoolBalances
}
/**
 * Computes the amount of shares that will be bought with `investmentAmount` amount collateral.
 *
 * @param investmentAmount The amount of collateral being put into the market maker
 * @param outcomeIndex The index of the outcome being bought
 * @param poolBalances How many tokens the market maker has of each outcome
 * @param fee The fee of the market maker, between 0 and 1
 */
export const calcBuyAmountInShares = (
  investmentAmount: BigNumber,
  outcomeIndex: number,
  poolBalances: BigNumber[],
  fee: number,
): BigNumber => {
  if (outcomeIndex < 0 || outcomeIndex >= poolBalances.length) {
    throw new Error(`Outcome index '${outcomeIndex}' must be between 0 and '${poolBalances.length - 1}'`)
  }
  if (investmentAmount.isZero() || poolBalances.every(x => x.isZero())) return WeiPerEther

  const investmentAmountMinusFees = mulBN(investmentAmount, 1 - fee)
  const newOutcomeBalance = poolBalances.reduce(
    (accumulator: BigNumber, poolBalance, i) =>
      i !== outcomeIndex
        ? ceilDiv(accumulator.mul(poolBalance), poolBalance.add(investmentAmountMinusFees))
        : accumulator.mul(poolBalance),
    WeiPerEther,
  )

  return poolBalances[outcomeIndex].add(investmentAmountMinusFees).sub(ceilDiv(newOutcomeBalance, WeiPerEther))
}
/**
 * Computes the amount of collateral that needs to be sold to get `shares` amount of shares. Returns null if the amount
 * couldn't be computed.
 *
 * @param sharesToSell The amount of shares that need to be sold
 * @param outcomeIndex The index of the outcome being bought
 * @param poolBalances How many tokens the market maker has of each outcome
 * @param fee The fee of the market maker, between 0 and 1
 */
export const calcSellAmountInCollateral = (
  sharesToSell: BigNumber,
  holdings: BigNumber,
  otherHoldings: BigNumber[],
  fee: number,
): Maybe<BigNumber> => {
  Big.DP = 90
  const sharesToSellBig = new Big(sharesToSell.toString())
  const holdingsBig = new Big(holdings.toString())
  const otherHoldingsBig = otherHoldings.map(x => new Big(x.toString()))

  const f = (r: Big) => {
    // For three outcomes, where the first outcome is the one being sold, the formula is:
    // f(r) = ((y - R) * (z - R)) * (x  + a - R) - x*y*z
    // where:
    //   `R` is r / (1 - fee)
    //   `x`, `y`, `z` are the market maker holdings for each outcome
    //   `a` is the amount of outcomes that are being sold
    //   `r` (the unknown) is the amount of collateral that will be returned in exchange of `a` tokens
    const R = r.div(1 - fee)
    const firstTerm = otherHoldingsBig.map(h => h.minus(R)).reduce((a, b) => a.mul(b))
    const secondTerm = holdingsBig.plus(sharesToSellBig).minus(R)
    const thirdTerm = otherHoldingsBig.reduce((a, b) => a.mul(b), holdingsBig)
    return firstTerm.mul(secondTerm).minus(thirdTerm)
  }

  const r = newtonRaphson(f, 0, { maxIterations: 100 })

  if (r) {
    const amountToSell = bigNumberify(r.toFixed(0))
    return amountToSell
  }

  return null
}

export const calcXValue = (currentPrediction: BigNumber, lowerBound: BigNumber, upperBound: BigNumber) => {
  const currentPredictionNumber = bigNumberToNumber(currentPrediction, STANDARD_DECIMALS)
  const lowerBoundNumber = bigNumberToNumber(lowerBound, STANDARD_DECIMALS)
  const upperBoundNumber = bigNumberToNumber(upperBound, STANDARD_DECIMALS)
  const xValue = ((currentPredictionNumber - lowerBoundNumber) / (upperBoundNumber - lowerBoundNumber)) * 100
  return xValue > 100 ? 100 : xValue < 0 ? 0 : xValue
}

export const calcPrediction = (probability: string, lowerBound: BigNumber, upperBound: BigNumber) => {
  const probabilityNumber = Number(probability)
  const lowerBoundNumber = bigNumberToNumber(lowerBound, STANDARD_DECIMALS)
  const upperBoundNumber = bigNumberToNumber(upperBound, STANDARD_DECIMALS)
  const prediction = probabilityNumber * (upperBoundNumber - lowerBoundNumber) + lowerBoundNumber
  return prediction
}

/**
 * Computes the cost in collateral of trading `tradeYes` and `tradeNo` outcomes, given that the initial funding is
 * `funding` and the current prices.
 */
export const calcNetCost = (
  funding: BigNumber,
  priceYes: number,
  tradeYes: BigNumber,
  priceNo: number,
  tradeNo: BigNumber,
): BigNumber => {
  // funding * (offset + log2(oddYes * (2^(tradeYes / funding - offset)) + oddNo * (2^(tradeNo / funding) - offset))
  const offset = Math.max(divBN(tradeYes, funding), divBN(tradeNo, funding))

  const logTerm =
    offset +
    Math.log2(
      priceYes * Math.pow(2, divBN(tradeYes, funding) - offset) +
        priceNo * Math.pow(2, divBN(tradeNo, funding) - offset),
    )
  return mulBN(funding, logTerm)
}
