import { Zero } from 'ethers/constants'
import { BigNumber, defaultAbiCoder, keccak256 } from 'ethers/utils'
import moment from 'moment'

import { Transaction } from '../../util/cpk'
import { getLogger } from '../../util/logger'
import {
  getContractAddress,
  getNativeAsset,
  getTokenFromAddress,
  getWrapToken,
  pseudoNativeAssetAddress,
} from '../../util/networks'
import { calcDistributionHint, clampBigNumber } from '../../util/tools'
import { MarketData, Question, Token, TransactionStep } from '../../util/types'
import { ConditionalTokenService } from '../conditional_token'
import { ERC20Service } from '../erc20'
import { MarketMakerService } from '../market_maker'
import { MarketMakerFactoryService } from '../market_maker_factory'
import { OracleService } from '../oracle'
import { RealitioService } from '../realitio'
import { UnwrapTokenService } from '../unwrap_token'

import { CPKService, TxOptions } from './cpk'

const logger = getLogger('Services::CPKService')

// @ts-expect-error ignore
export const pipe = (...fns) => input => fns.reduce((chain, func) => chain.then(func), Promise.resolve(input))

const getMarketCollateral = (token: Token, networkId: number) => {
  if (token.address.toLowerCase() === pseudoNativeAssetAddress.toLowerCase()) {
    return getWrapToken(networkId)
  }
  return token
}

/**
 * Setup the basic information each pipe needs, e.g. networkId, account, empty transaction array
 */

interface SetupParams {
  service: CPKService
}

export const setup = async (params: SetupParams) => {
  const { service } = params

  // account
  const signer = service.provider.getSigner()
  const account = await signer.getAddress()

  // network id
  const network = await service.provider.getNetwork()
  const networkId = network.chainId

  // empty tx array
  const transactions: Transaction[] = []

  // tx options
  const txOptions: TxOptions = {}

  // tokens
  const wrapper = getWrapToken(networkId)
  const native = getNativeAsset(networkId)

  return { ...params, account, native, networkId, transactions, txOptions, wrapper }
}

interface ExecParams {
  service: CPKService
  transactions: Transaction[]
  txOptions: TxOptions
  setTxHash: (arg0: string) => void
  setTxState: (step: TransactionStep) => void
}

export const exec = async (params: ExecParams) => {
  const { service, setTxHash, setTxState, transactions, txOptions } = params
  if (service.cpk.relay) {
    const { address, fee } = await service.relayService.getInfo()
    transactions.push({
      to: address,
      value: fee,
    })
  }

  const txObject = await service.cpk.execTransactions(transactions, txOptions)
  setTxState(TransactionStep.transactionSubmitted)
  setTxHash(txObject.hash)
  const transaction = await service.waitForTransaction(txObject)
  setTxState(TransactionStep.transactionConfirmed)
  return { ...params, transaction }
}

/**
 * Subtract the relay fee from the input amount if required
 */

interface FeeParams {
  service: CPKService
  amount: BigNumber
}

export const fee = async (params: FeeParams) => {
  const { service } = params
  const amount = await service.subRelayFee(params.amount)
  return { ...params, amount }
}

/**
 * Wrap the input amount if required
 */

interface WrapParams {
  amount: BigNumber
  collateral: Token
  networkId: number
  native: Token
  service: CPKService
  transactions: Transaction[]
  txOptions: TxOptions
  wrapper: Token
}

export const wrap = async (params: WrapParams) => {
  const { amount, collateral, native, service, transactions, txOptions, wrapper } = params
  if (collateral.address.toLowerCase() === native.address.toLowerCase()) {
    if (!service.isSafeApp) {
      txOptions.value = amount
    }
    transactions.push({
      to: wrapper.address,
      value: amount.toString(),
    })
  }

  return params
}

/**
 * Unwrap the input amount if required
 */

interface UnwrapParams {
  amount: BigNumber
  collateral: Token
  transactions: Transaction[]
  networkId: number
  wrapper: Token
}

export const unwrap = async (params: UnwrapParams) => {
  const { amount, collateral, transactions, wrapper } = params
  if (collateral.address.toLowerCase() === wrapper.address.toLowerCase() && !amount.isZero()) {
    const encodedWithdrawFunction = UnwrapTokenService.withdrawAmount(collateral.symbol, amount)
    transactions.push({
      to: collateral.address,
      data: encodedWithdrawFunction,
    })
  }

  return params
}

/**
 * Make an unlimited approval to the market maker for the collateral token if required
 */

interface ApproveParams {
  collateral: Token
  marketMaker?: MarketMakerService
  marketMakerFactory?: MarketMakerFactoryService
  networkId: number
  transactions: Transaction[]
}

export const approve = async (params: ApproveParams) => {
  const { collateral, marketMaker, marketMakerFactory, networkId, transactions } = params
  const spender = marketMaker?.address || marketMakerFactory?.address
  if (spender) {
    transactions.push({
      to: getMarketCollateral(collateral, networkId).address,
      data: ERC20Service.encodeApproveUnlimited(spender),
    })
  }
  return params
}

/**
 * Set approval for the market maker to access conditional tokens
 */

interface ApproveConditionalTokensParams {
  conditionalTokens: ConditionalTokenService
  marketMaker: MarketMakerService
  service: CPKService
  transactions: Transaction[]
}

export const approveConditionalTokens = async (params: ApproveConditionalTokensParams) => {
  const { conditionalTokens, marketMaker, service, transactions } = params
  const isAlreadyApprovedForMarketMaker = await conditionalTokens.isApprovedForAll(
    service.cpk.address,
    marketMaker.address,
  )

  if (!isAlreadyApprovedForMarketMaker) {
    transactions.push({
      to: conditionalTokens.address,
      data: ConditionalTokenService.encodeSetApprovalForAll(marketMaker.address, true),
    })
  }

  return params
}

/**
 * Deposit the collateral amount to the CPK if required
 */

interface DepositParams {
  account: string
  amount: BigNumber
  collateral: Token
  native: Token
  service: CPKService
  transactions: Transaction[]
}

export const deposit = async (params: DepositParams) => {
  const { account, amount, collateral, native, service, transactions } = params
  if (!service.isSafeApp && collateral.address.toLowerCase() !== native.address.toLowerCase()) {
    // Step 2: Transfer the amount of collateral being spent from the user to the CPK
    transactions.push({
      to: collateral.address,
      data: ERC20Service.encodeTransferFrom(account, service.cpk.address, amount),
    })
  }
  return params
}

/**
 * Withdraw the collateral amount from the CPK if required
 */

interface WithdrawParams {
  account: string
  amount: BigNumber
  collateral: Token
  service: CPKService
  transactions: Transaction[]
  wrapper: Token
}

export const withdraw = async (params: WithdrawParams) => {
  const { account, amount, collateral, service, transactions, wrapper } = params
  if (!service.isSafeApp && !amount.isZero()) {
    if (collateral.address.toLowerCase() === wrapper.address.toLowerCase()) {
      transactions.push({
        to: account,
        value: amount.toString(),
      })
    } else {
      transactions.push({
        to: collateral.address,
        data: ERC20Service.encodeTransfer(account, amount),
      })
    }
  }
  return params
}

/**
 * Buy from the market maker with the input amount
 */

interface BuyParams {
  account: string
  amount: BigNumber
  collateral: Token
  marketMaker: MarketMakerService
  service: CPKService
  transactions: Transaction[]
  outcomeIndex: number
}

export const buy = async (params: BuyParams) => {
  const { amount, marketMaker, outcomeIndex, transactions } = params
  const outcomeTokensToBuy = await marketMaker.calcBuyAmount(amount, outcomeIndex)

  transactions.push({
    to: marketMaker.address,
    data: MarketMakerService.encodeBuy(amount, outcomeIndex, outcomeTokensToBuy),
  })

  return params
}

/**
 * Sell from the market maker with the input amount
 */

interface SellParams {
  amount: BigNumber
  marketMaker: MarketMakerService
  transactions: Transaction[]
  outcomeIndex: number
}

export const sell = async (params: SellParams) => {
  const { amount, marketMaker, outcomeIndex, transactions } = params
  const outcomeTokensToSell = await marketMaker.calcSellAmount(amount, outcomeIndex)

  transactions.push({
    to: marketMaker.address,
    data: MarketMakerService.encodeSell(amount, outcomeIndex, outcomeTokensToSell),
  })

  return params
}

/**
 * Fund the market maker with the input amount
 */

interface AddFundsParams {
  amount: BigNumber
  marketMaker: MarketMakerService
  transactions: Transaction[]
}

export const addFunds = async (params: AddFundsParams) => {
  const { amount, marketMaker, transactions } = params
  transactions.push({
    to: marketMaker.address,
    data: MarketMakerService.encodeAddFunding(amount),
  })
  return params
}

/**
 * Remove funds from the market maker
 */

interface RemoveFundsParams {
  amountToMerge: BigNumber
  collateral: Token
  conditionId: string
  conditionalTokens: ConditionalTokenService
  marketMaker: MarketMakerService
  outcomesCount: number
  transactions: Transaction[]
  sharesToBurn: BigNumber
}

export const removeFunds = async (params: RemoveFundsParams) => {
  const {
    amountToMerge,
    collateral,
    conditionId,
    conditionalTokens,
    marketMaker,
    outcomesCount,
    sharesToBurn,
    transactions,
  } = params

  transactions.push({
    to: marketMaker.address,
    data: MarketMakerService.encodeRemoveFunding(sharesToBurn),
  })

  transactions.push({
    to: conditionalTokens.address,
    data: ConditionalTokenService.encodeMergePositions(collateral.address, conditionId, outcomesCount, amountToMerge),
  })

  return params
}

/**
 * Withdraw balance from realitio
 */

interface WithdrawRealitioParams {
  account: string
  networkId: number
  realitioBalance: BigNumber
  service: CPKService
  transactions: Transaction[]
}

export const withdrawRealitioBalance = async (params: WithdrawRealitioParams) => {
  const { account, networkId, realitioBalance, service, transactions } = params
  // If user has realitio balance, withdraw
  if (!realitioBalance.isZero()) {
    transactions.push({
      to: getContractAddress(networkId, 'realitio'),
      data: RealitioService.encodeWithdraw(),
    })
    if (!service.isSafeApp) {
      transactions.push({
        to: account,
        value: realitioBalance.toString(),
      })
    }
  }
  return params
}

/**
 * Create question
 */

interface CreateQuestionParams {
  marketData: MarketData
  realitio: RealitioService
  transactions: Transaction[]
  networkId: number
  service: CPKService
}

export const createQuestion = async (params: CreateQuestionParams) => {
  const { marketData, networkId, realitio, service, transactions } = params
  const { arbitrator, category, loadedQuestionId, lowerBound, outcomes, question, resolution, unit } = marketData

  if (!resolution) {
    throw new Error('Resolution time was not specified')
  }

  const isScalar = lowerBound ? true : false
  const openingDateMoment = moment(resolution)

  let questionId: string
  if (loadedQuestionId) {
    questionId = loadedQuestionId
  } else {
    if (isScalar) {
      // Create question in realitio without bounds
      transactions.push({
        to: realitio.address,
        data: RealitioService.encodeAskScalarQuestion(
          question,
          unit,
          category,
          arbitrator.address,
          openingDateMoment,
          networkId,
        ),
      })
      questionId = await realitio.askScalarQuestionConstant(
        question,
        unit,
        category,
        arbitrator.address,
        openingDateMoment,
        networkId,
        service.cpk.address,
      )
    } else {
      // Create question in realitio
      transactions.push({
        to: realitio.address,
        data: RealitioService.encodeAskQuestion(
          question,
          outcomes,
          category,
          arbitrator.address,
          openingDateMoment,
          networkId,
        ),
      })
      questionId = await realitio.askQuestionConstant(
        question,
        outcomes,
        category,
        arbitrator.address,
        openingDateMoment,
        networkId,
        service.cpk.address,
      )
    }
  }

  logger.log(`QuestionID ${questionId}`)

  return { ...params, isScalar, questionId }
}

/**
 * Announce the questionId and its bounds to the RealitioScalarAdapter
 */

interface AnnounceConditionIdParams {
  marketData: MarketData
  realitio: RealitioService
  transactions: Transaction[]
  service: CPKService
  questionId: string
}

export const announceCondition = async (params: AnnounceConditionIdParams) => {
  const { marketData, questionId, realitio, transactions } = params
  const { lowerBound, upperBound } = marketData
  const scalarQuestionId = keccak256(
    defaultAbiCoder.encode(['bytes32', 'uint256', 'uint256'], [questionId, lowerBound, upperBound]),
  )
  if (lowerBound && upperBound) {
    logger.log(`Reality.eth QuestionID ${questionId}`)
    logger.log(`Conditional Tokens QuestionID ${scalarQuestionId}`)

    transactions.push({
      to: realitio.scalarContract.address,
      data: RealitioService.encodeAnnounceConditionQuestionId(questionId, lowerBound, upperBound),
    })
  }

  return { ...params, scalarQuestionId }
}

/**
 * Validate oracle config
 */

interface ValidateOracleParams {
  account: string
  scalarQuestionId: Maybe<string>
  conditionalTokens: ConditionalTokenService
  realitio: RealitioService
  transactions: Transaction[]
  service: CPKService
  networkId: number
}

export const validateOracle = async (params: ValidateOracleParams) => {
  const { account, conditionalTokens, networkId, realitio, scalarQuestionId, service } = params
  const oracleAddress = getContractAddress(networkId, scalarQuestionId ? 'realitioScalarAdapter' : 'oracle')
  const oracle = new OracleService(oracleAddress, service.provider, account)
  if (realitio.address.toLowerCase() !== (await oracle.realitio()).toLowerCase()) {
    throw new Error('Oracle / Realitio mismatch ')
  }

  if (conditionalTokens.address.toLowerCase() !== (await oracle.conditionalTokens()).toLowerCase()) {
    throw new Error('Oracle / Conditional Tokens mismatch ')
  }

  return params
}

/**
 * Prepare condition
 */

interface PrepareConditionParams {
  scalarQuestionId: Maybe<string>
  conditionalTokens: ConditionalTokenService
  marketData: MarketData
  realitio: RealitioService
  transactions: Transaction[]
  networkId: number
  service: CPKService
  questionId: string
}

export const prepareCondition = async (params: PrepareConditionParams) => {
  const { conditionalTokens, marketData, networkId, questionId, scalarQuestionId, transactions } = params
  const { outcomes } = marketData
  const oracleAddress = getContractAddress(networkId, scalarQuestionId ? 'realitioScalarAdapter' : 'oracle')
  const outcomeSlotCount = scalarQuestionId ? 2 : outcomes.length
  const selectedQuestionId = scalarQuestionId || questionId
  const conditionId = conditionalTokens.getConditionId(selectedQuestionId, oracleAddress, outcomeSlotCount)

  const conditionExists = await conditionalTokens.doesConditionExist(conditionId)
  if (!conditionExists) {
    transactions.push({
      to: conditionalTokens.address,
      data: ConditionalTokenService.encodePrepareCondition(selectedQuestionId, oracleAddress, outcomeSlotCount),
    })
  }

  logger.log(`ConditionID: ${conditionId}`)

  return { ...params, conditionId }
}

/**
 * Resolve condition
 */

interface ResolveConditionParams {
  isConditionResolved: boolean
  isScalar: boolean
  numOutcomes: number
  oracle: OracleService
  question: Question
  realitio: RealitioService
  scalarLow: Maybe<BigNumber>
  scalarHigh: Maybe<BigNumber>
  transactions: Transaction[]
}

export const resolveCondition = async (params: ResolveConditionParams) => {
  const {
    isConditionResolved,
    isScalar,
    numOutcomes,
    oracle,
    question,
    realitio,
    scalarHigh,
    scalarLow,
    transactions,
  } = params
  if (!isConditionResolved) {
    if (isScalar && scalarLow && scalarHigh) {
      transactions.push({
        to: realitio.scalarContract.address,
        data: RealitioService.encodeResolveCondition(question.id, question.raw, scalarLow, scalarHigh),
      })
    } else {
      transactions.push({
        to: oracle.contract.address,
        data: OracleService.encodeResolveCondition(question.id, question.templateId, question.raw, numOutcomes),
      })
    }
  }

  return params
}

/**
 * Claim winnings
 */

interface ClaimWinningsParams {
  isConditionResolved: boolean
  question: Question
  realitio: RealitioService
  transactions: Transaction[]
}

export const claimWinnings = async (params: ClaimWinningsParams) => {
  const { isConditionResolved, question, realitio, transactions } = params

  if (!isConditionResolved) {
    const data = await realitio.encodeClaimWinnings(question.id)
    if (data) {
      transactions.push({
        to: realitio.contract.address,
        data,
      })
    }
  }

  return params
}

/**
 * Redeem position
 */

interface RedeemPositionParams {
  amount: BigNumber
  conditionalTokens: ConditionalTokenService
  collateral: Token
  isConditionResolved: boolean
  question: Question
  numOutcomes: number
  marketMaker: MarketMakerService
  realitio: RealitioService
  transactions: Transaction[]
}

export const redeemPosition = async (params: RedeemPositionParams) => {
  const { amount, collateral, conditionalTokens, marketMaker, numOutcomes, transactions } = params

  const conditionId = await marketMaker.getConditionId()
  if (!amount.isZero()) {
    transactions.push({
      to: conditionalTokens.address,
      data: ConditionalTokenService.encodeRedeemPositions(collateral.address, conditionId, numOutcomes),
    })
  }

  return params
}

/**
 * Create market maker
 */

interface CreateMarketParams {
  amount: BigNumber
  conditionId: string
  collateral: Token
  conditionalTokens: ConditionalTokenService
  marketData: MarketData
  marketMakerFactory: MarketMakerFactoryService
  realitio: RealitioService
  transactions: Transaction[]
  networkId: number
  service: CPKService
  isScalar: boolean
}

export const createMarket = async (params: CreateMarketParams) => {
  const {
    amount,
    conditionId,
    conditionalTokens,
    isScalar,
    marketData,
    marketMakerFactory,
    networkId,
    service,
    transactions,
  } = params

  const { lowerBound, outcomes, spread, startingPoint, upperBound } = marketData

  if (isScalar) {
    if (!lowerBound) {
      throw new Error('Lower bound not specified')
    }

    if (!upperBound) {
      throw new Error('Upper bound not specified')
    }

    if (!startingPoint) {
      throw new Error('Starting expected value not specified')
    }

    if (lowerBound.gt(startingPoint) || startingPoint.gt(upperBound)) {
      throw new Error('Starting expected value should be between lowerBound and upperBound')
    }
  }

  // generate predicted marketMaker address
  const collateral = getMarketCollateral(params.collateral, networkId)
  const saltNonce = Math.round(Math.random() * 1000000)
  const predictedMarketMakerAddress = await marketMakerFactory.predictMarketMakerAddress(
    saltNonce,
    conditionalTokens.address,
    collateral.address,
    conditionId,
    service.cpk.address,
    spread,
  )
  logger.log(`Predicted market maker address: ${predictedMarketMakerAddress}`)

  // calculate distribution hint
  let distributionHint
  if (isScalar && upperBound && lowerBound && startingPoint) {
    const domainSize = upperBound.sub(lowerBound)
    const a = clampBigNumber(upperBound.sub(startingPoint), Zero, domainSize)
    const b = clampBigNumber(startingPoint.sub(lowerBound), Zero, domainSize)
    distributionHint = [b, a]
  } else {
    distributionHint = calcDistributionHint(outcomes.map(o => o.probability))
  }

  // create market tx
  transactions.push({
    to: marketMakerFactory.address,
    data: MarketMakerFactoryService.encodeCreateMarketMaker(
      saltNonce,
      conditionalTokens.address,
      collateral.address,
      conditionId,
      spread,
      amount,
      distributionHint,
    ),
  })

  return { ...params, predictedMarketMakerAddress }
}

/**
 * Wrangle Functions
 * The purpose of wrangle functions is to transform params into common inputs other functions depend on
 * collateral: The collateral the market maker is using
 * amount: The amount being spent/withdrawn
 */

/**
 * Wrangle create market data
 */

interface WrangleCreateMarketParams {
  marketData: MarketData
}

export const wrangleCreateMarketParams = async (params: WrangleCreateMarketParams) => {
  const { marketData } = params
  return { ...params, amount: marketData.funding, collateral: marketData.collateral }
}

/**
 * Wrangle sell input data
 */

interface WrangleSellParams {
  marketData: MarketData
  marketMaker: MarketMakerService
  networkId: number
}

export const wrangleSellParams = async (params: WrangleSellParams) => {
  const { marketMaker, networkId } = params
  const collateralAddress = await marketMaker.getCollateralToken()
  const collateral = getTokenFromAddress(networkId, collateralAddress)
  return { ...params, collateral }
}

/**
 * Wrangle remove funds input data
 */

interface WrangleRemoveFundsParams {
  amountToMerge: BigNumber
  earnings: BigNumber
  marketData: MarketData
  marketMaker: MarketMakerService
  networkId: number
}

export const wrangleRemoveFundsParams = async (params: WrangleRemoveFundsParams) => {
  const { amountToMerge, earnings, marketMaker, networkId } = params
  const collateralAddress = await marketMaker.getCollateralToken()
  const collateral = getTokenFromAddress(networkId, collateralAddress)
  const amount = amountToMerge.add(earnings)

  return { ...params, amount, collateral }
}
