import { Contract, Wallet, ethers, utils } from 'ethers'
import { BigNumber } from 'ethers/utils'

import { getLogger } from '../util/logger'
import { getContractAddress } from '../util/networks'
import { calcDistributionHint, calcPrice } from '../util/tools'
import { Market, MarketStatus, MarketWithExtraData } from '../util/types'

import { ConditionalTokenService } from './conditional_token'
import { RealitioService } from './realitio'

const logger = getLogger('Services::MarketMaker')

const marketMakerAbi = [
  'function conditionalTokens() external view returns (address)',
  'function balanceOf(address addr) external view returns (uint256)',
  'function collateralToken() external view returns (address)',
  'function fee() external view returns (uint)',
  'function conditionIds(uint256) external view returns (bytes32)',
  'function addFunding(uint addedFunds, uint[] distributionHint) external',
  'function removeFunding(uint sharesToBurn) external',
  'function totalSupply() external view returns (uint256)',
  'function collectedFees() external view returns (uint)',
  'function feesWithdrawableBy(address addr) public view returns (uint)',
  'function buy(uint investmentAmount, uint outcomeIndex, uint minOutcomeTokensToBuy) external',
  'function calcBuyAmount(uint investmentAmount, uint outcomeIndex) public view returns (uint)',
  'function sell(uint returnAmount, uint outcomeIndex, uint maxOutcomeTokensToSell) external',
  'function calcSellAmount(uint returnAmount, uint outcomeIndex) public view returns (uint)',
]

class MarketMakerService {
  contract: Contract
  conditionalTokens: ConditionalTokenService
  realitio: RealitioService
  provider: any

  constructor(
    address: string,
    conditionalTokens: ConditionalTokenService,
    realitio: RealitioService,
    provider: any,
    signerAddress: Maybe<string>,
  ) {
    if (signerAddress) {
      const signer: Wallet = provider.getSigner()

      this.contract = new ethers.Contract(address, marketMakerAbi, provider).connect(signer)
    } else {
      this.contract = new ethers.Contract(address, marketMakerAbi, provider)
    }

    this.conditionalTokens = conditionalTokens
    this.realitio = realitio
    this.provider = provider
  }

  get address(): string {
    return this.contract.address
  }

  getTransaction = async (transactionHash: string): Promise<string> => {
    return this.provider.getTransaction(transactionHash)
  }

  getConditionalTokens = async (): Promise<string> => {
    return this.contract.conditionalTokens()
  }

  getCollateralToken = async (): Promise<string> => {
    return this.contract.collateralToken()
  }

  getFee = async (): Promise<BigNumber> => {
    return this.contract.fee()
  }

  getConditionId = async () => {
    return await this.contract.conditionIds(0)
  }

  getTotalSupply = async (): Promise<BigNumber> => {
    return this.contract.totalSupply()
  }

  getCollectedFees = async (networkId: number, factory: string): Promise<BigNumber> => {
    if (factory.toLowerCase() !== getContractAddress(networkId, 'marketMakerFactory').toLowerCase()) {
      return new BigNumber(0)
    }
    return this.contract.collectedFees()
  }

  getFeesWithdrawableBy = async (account: string, networkId: number, factory: string): Promise<BigNumber> => {
    if (factory.toLowerCase() !== getContractAddress(networkId, 'marketMakerFactory').toLowerCase()) {
      return new BigNumber(0)
    }
    return this.contract.feesWithdrawableBy(account)
  }

  addInitialFunding = async (amount: BigNumber, initialOdds: number[]) => {
    logger.log(`Add funding to market maker ${amount}`)

    const distributionHint = calcDistributionHint(initialOdds)

    return this.addFunding(amount, distributionHint)
  }

  addFunding = async (amount: BigNumber, distributionHint: BigNumber[] = []) => {
    logger.log(`Add funding to market maker ${amount}`)

    try {
      const overrides = {
        value: '0x0',
        gasLimit: 750000,
      }
      const transactionObject = await this.contract.addFunding(amount, distributionHint, overrides)
      await this.provider.waitForTransaction(transactionObject.hash)
    } catch (err) {
      logger.error(`There was an error adding '${amount.toString()}' of funding'`, err.message)
      throw err
    }
  }

  removeFunding = async (amount: BigNumber) => {
    logger.log(`Remove funding to market maker ${amount}`)
    return this.contract.removeFunding(amount, {
      value: '0x0',
    })
  }

  static getActualPrice = (holdings: BigNumber[]): number[] => {
    return calcPrice(holdings)
  }

  /**
   * Return the holdings of each outcome for the given address
   */
  getBalanceInformation = async (ownerAddress: string, outcomeQuantity: number): Promise<BigNumber[]> => {
    const conditionId = await this.getConditionId()
    const collateralTokenAddress = await this.getCollateralToken()

    const balances = []
    logger.debug(`Balance information :: Outcomes quantity ${outcomeQuantity}`)
    for (let i = 0; i < outcomeQuantity; i++) {
      const collectionId = await this.conditionalTokens.getCollectionIdForOutcome(conditionId, 1 << i)
      logger.debug(
        `Balance information :: Collection ID for outcome index ${i} and condition id ${conditionId} : ${collectionId}`,
      )
      const positionIdForCollectionId = await this.conditionalTokens.getPositionId(collateralTokenAddress, collectionId)
      const balance = await this.conditionalTokens.getBalanceOf(ownerAddress, positionIdForCollectionId)
      logger.debug(`Balance information :: Balance ${balance.toString()}`)
      balances.push(balance)
    }
    return balances
  }
  getBalanceInformationByBlock = async (
    ownerAddress: any,
    outcomeQuantity: number,
    block: any,
  ): Promise<BigNumber[]> => {
    const conditionId = await this.getConditionId()
    const collateralTokenAddress = await this.getCollateralToken()

    const balances = []
    logger.debug(`Balance information :: Outcomes quantity ${outcomeQuantity}`)
    for (let i = 0; i < outcomeQuantity; i++) {
      const collectionId = await this.conditionalTokens.getCollectionIdForOutcome(conditionId, 1 << i)
      logger.debug(
        `Balance information :: Collection ID for outcome index ${i} and condition id ${conditionId} : ${collectionId}`,
      )
      const positionIdForCollectionId = await this.conditionalTokens.getPositionId(collateralTokenAddress, collectionId)

      const balance = await this.conditionalTokens.getBalanceOfByBlock(
        ownerAddress,
        positionIdForCollectionId,
        block.blockNumber,
      )

      logger.debug(`Balance information :: Balance ${balance.toString()}`)
      balances.push(balance)
    }

    return balances
  }

  balanceOf = async (address: string): Promise<BigNumber> => {
    return this.contract.balanceOf(address)
  }

  buy = async (amount: BigNumber, outcomeIndex: number) => {
    try {
      const outcomeTokensToBuy = await this.contract.calcBuyAmount(amount, outcomeIndex)
      const transactionObject = await this.contract.buy(amount, outcomeIndex, outcomeTokensToBuy, {
        value: '0x0',
      })
      await this.provider.waitForTransaction(transactionObject.hash)
    } catch (err) {
      logger.error(`There was an error buying '${amount.toString()}' for outcome '${outcomeIndex}'`, err.message)
      throw err
    }
  }

  calcBuyAmount = async (amount: BigNumber, outcomeIndex: number): Promise<BigNumber> => {
    try {
      return this.contract.calcBuyAmount(amount, outcomeIndex)
    } catch (err) {
      logger.error(
        `There was an error computing the buy amount for amount '${amount.toString()}' and outcome index '${outcomeIndex}'`,
        err.message,
      )
      throw err
    }
  }

  calcSellAmount = async (amount: BigNumber, outcomeIndex: number): Promise<BigNumber> => {
    try {
      return this.contract.calcSellAmount(amount, outcomeIndex)
    } catch (err) {
      logger.error(
        `There was an error computing the sell amount for amount '${amount.toString()}' and outcome index '${outcomeIndex}'`,
        err.message,
      )
      throw err
    }
  }

  poolSharesTotalSupply = async (): Promise<BigNumber> => {
    try {
      return this.contract.totalSupply()
    } catch (err) {
      logger.error(`There was an error getting the supply of pool shares`, err.message)
      throw err
    }
  }
  poolSharesTotalSupplyByBlockNumber = async (data: number): Promise<BigNumber> => {
    try {
      return this.contract.totalSupply({ blockTag: data })
    } catch (err) {
      logger.error(`There was an error getting the supply of pool shares`, err.message)
      throw err
    }
  }

  poolSharesBalanceOf = async (address: string): Promise<BigNumber> => {
    try {
      return this.contract.balanceOf(address)
    } catch (err) {
      logger.error(`There was an error getting the balance of pool shares for '${address}''`, err.message)
      throw err
    }
  }

  sell = async (amount: BigNumber, outcomeIndex: number) => {
    try {
      const outcomeTokensToSell = await this.contract.calcSellAmount(amount, outcomeIndex)
      const overrides = {
        value: '0x0',
        gasLimit: 750000,
      }

      const transactionObject = await this.contract.sell(amount, outcomeIndex, outcomeTokensToSell, overrides)
      await this.provider.waitForTransaction(transactionObject.hash)
    } catch (err) {
      logger.error(`There was an error selling '${amount.toString()}' for outcome index '${outcomeIndex}'`, err.message)
      throw err
    }
  }

  getExtraData = async (market: Market): Promise<MarketWithExtraData> => {
    const { conditionId } = market
    // Get question data
    const questionId = await this.conditionalTokens.getQuestionId(conditionId)
    const question = await this.realitio.getQuestion(questionId)
    // Know if a market is open or closed
    const isQuestionFinalized = await this.realitio.isFinalized(questionId)
    const marketStatus = isQuestionFinalized ? MarketStatus.Closed : MarketStatus.Open

    const fee = await this.getFee()

    return {
      ...market,
      question,
      status: marketStatus,
      fee,
    }
  }

  static encodeBuy = (amount: BigNumber, outcomeIndex: number, outcomeTokensToBuy: BigNumber): string => {
    const buyInterface = new utils.Interface(marketMakerAbi)

    return buyInterface.functions.buy.encode([amount, outcomeIndex, outcomeTokensToBuy])
  }

  static encodeSell = (amount: BigNumber, outcomeIndex: number, maxOutcomeTokensToSell: BigNumber): string => {
    const sellInterface = new utils.Interface(marketMakerAbi)

    return sellInterface.functions.sell.encode([amount, outcomeIndex, maxOutcomeTokensToSell])
  }

  static encodeAddFunding = (amount: BigNumber, distributionHint: BigNumber[] = []): string => {
    const addFundingInterface = new utils.Interface(marketMakerAbi)

    return addFundingInterface.functions.addFunding.encode([amount, distributionHint])
  }

  static encodeRemoveFunding = (amount: BigNumber): string => {
    const removeFundingInterface = new utils.Interface(marketMakerAbi)

    return removeFundingInterface.functions.removeFunding.encode([amount])
  }
}

export { MarketMakerService }
