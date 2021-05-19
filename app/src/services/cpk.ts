import { Zero } from 'ethers/constants'
import { TransactionReceipt, Web3Provider } from 'ethers/providers'
import { BigNumber, bigNumberify, defaultAbiCoder, keccak256 } from 'ethers/utils'
import moment from 'moment'

import {
  GEN_TOKEN_ADDDRESS_TESTING,
  GEN_XDAI_ADDRESS_TESTING,
  OMNI_BRIDGE_XDAI_ADDRESS,
  RELAY_ADDRESS,
  RELAY_FEE,
  XDAI_TO_DAI_TOKEN_BRIDGE_ADDRESS,
} from '../common/constants'
import { Transaction, verifyProxyAddress } from '../util/cpk'
import { getLogger } from '../util/logger'
import {
  getBySafeTx,
  getContractAddress,
  getNativeAsset,
  getTargetSafeImplementation,
  getToken,
  getTokenFromAddress,
  getWrapToken,
  networkIds,
  pseudoNativeAssetAddress,
  waitForBlockToSync,
} from '../util/networks'
import {
  calcAddFundingSendAmounts,
  calcDistributionHint,
  clampBigNumber,
  getBaseToken,
  getBaseTokenForCToken,
  isCToken,
  signaturesFormatted,
  waitABit,
} from '../util/tools'
import { ExchangeCurrency, MarketData, Question, Token, TransactionStep } from '../util/types'

import { CompoundService } from './compound_service'
import { ConditionalTokenService } from './conditional_token'
import { ERC20Service } from './erc20'
import { MarketMakerService } from './market_maker'
import { MarketMakerFactoryService } from './market_maker_factory'
import { OracleService } from './oracle'
import { OvmService } from './ovm'
import { RealitioService } from './realitio'
import { SafeService } from './safe'
import { StakingService } from './staking'
import { UnwrapTokenService } from './unwrap_token'
import { XdaiService } from './xdai'

const logger = getLogger('Services::CPKService')

const defaultGas = 1500000

interface CPKBuyOutcomesParams {
  amount: BigNumber
  collateral: Token
  compoundService?: CompoundService | null
  outcomeIndex: number
  useBaseToken?: boolean
  marketMaker: MarketMakerService
  setTxHash: (arg0: string) => void
  setTxState: (step: TransactionStep) => void
}

interface CPKSellOutcomesParams {
  amount: BigNumber
  collateralToken: Token
  compoundService?: CompoundService | null
  outcomeIndex: number
  marketMaker: MarketMakerService
  conditionalTokens: ConditionalTokenService
  useBaseToken?: boolean
  setTxHash: (arg0: string) => void
  setTxState: (step: TransactionStep) => void
}

interface CPKCreateMarketParams {
  compoundService?: CompoundService | null
  compoundTokenDetails?: Token
  marketData: MarketData
  conditionalTokens: ConditionalTokenService
  realitio: RealitioService
  marketMakerFactory: MarketMakerFactoryService
  useCompoundReserve?: boolean
  setTxHash: (arg0: string) => void
  setTxState: (step: TransactionStep) => void
}

interface CPKAddFundingParams {
  amount: BigNumber
  collateral: Token
  compoundService?: CompoundService | null
  marketMaker: MarketMakerService
  useBaseToken?: boolean
  setTxHash: (arg0: string) => void
  setTxState: (step: TransactionStep) => void
}

interface CPKRemoveFundingParams {
  amountToMerge: BigNumber
  collateralAddress: string
  compoundService?: CompoundService | null
  conditionId: string
  conditionalTokens: ConditionalTokenService
  earnings: BigNumber
  marketMaker: MarketMakerService
  outcomesCount: number
  setTxHash: (arg0: string) => void
  setTxState: (step: TransactionStep) => void
  sharesToBurn: BigNumber
  useBaseToken?: boolean
}

interface CPKRedeemParams {
  isConditionResolved: boolean
  question: Question
  numOutcomes: number
  earnedCollateral: BigNumber
  collateralToken: Token
  oracle: OracleService
  marketMaker: MarketMakerService
  conditionalTokens: ConditionalTokenService
  setTxHash: (arg0: string) => void
  setTxState: (step: TransactionStep) => void
}

interface CPKResolveParams {
  isScalar: boolean
  realitio: RealitioService
  oracle: OracleService
  question: Question
  numOutcomes: number
  scalarLow: Maybe<BigNumber>
  scalarHigh: Maybe<BigNumber>
  setTxHash: (arg0: string) => void
  setTxState: (step: TransactionStep) => void
}

interface CPKSubmitAnswerParams {
  realitio: RealitioService
  question: Question
  answer: string
  amount: BigNumber
  setTxHash: (arg0: string) => void
  setTxState: (step: TransactionStep) => void
}

interface CPKDepositAndStakeParams {
  amount: BigNumber
  campaignAddress: string
  collateral: Token
  compoundService?: CompoundService | null
  holdingsBN: BigNumber[]
  marketMaker: MarketMakerService
  poolShareSupply: BigNumber
  useBaseToken?: boolean
  setTxHash: (arg0: string) => void
  setTxState: (step: TransactionStep) => void
}

interface CPKUnstakeClaimAndWithdrawParams {
  amountToMerge: BigNumber
  campaignAddress: string
  collateralAddress: string
  compoundService?: CompoundService | null
  conditionId: string
  conditionalTokens: ConditionalTokenService
  earnings: BigNumber
  marketMaker: MarketMakerService
  outcomesCount: number
  setTxHash: (arg0: string) => void
  setTxState: (step: TransactionStep) => void
  sharesToBurn: BigNumber
  useBaseToken?: boolean
}

interface TransactionResult {
  hash?: string
  safeTxHash?: string
}

interface TxOptions {
  value?: BigNumber
  gas?: number
}

const fallbackMultisigTransactionReceipt: TransactionReceipt = {
  byzantium: true,
}

interface CPKRequestVerificationParams {
  params: string
  ovmAddress: string
  submissionDeposit: string
}

interface CreateMarketResult {
  transaction: TransactionReceipt
  marketMakerAddress: string
}
class CPKService {
  cpk: any
  provider: Web3Provider
  safe: SafeService

  constructor(cpk: any, provider: Web3Provider) {
    this.cpk = cpk
    this.provider = provider
    this.safe = new SafeService(cpk.address, provider)
  }

  get address(): string {
    return this.cpk.address
  }

  get isSafeApp(): boolean {
    if (this.cpk.relay || this.cpk.isConnectedToSafe || this.cpk.isSafeApp()) {
      return true
    }
    return false
  }

  waitForTransaction = async (txObject: TransactionResult): Promise<TransactionReceipt> => {
    let transactionReceipt: TransactionReceipt
    if (txObject.hash && !this.cpk.isConnectedToSafe) {
      // standard transaction
      logger.log(`Transaction hash: ${txObject.hash}`)
      // @ts-expect-error ignore
      while (!transactionReceipt) {
        try {
          transactionReceipt = await this.provider.waitForTransaction(txObject.hash)
        } catch (e) {
          logger.log(e.message)
        }
      }
    } else {
      const safeTxHash = txObject.hash || txObject.safeTxHash
      // transaction through the safe app sdk
      const threshold = await this.safe.getThreshold()
      if (threshold.toNumber() === 1 && safeTxHash) {
        logger.log(`Safe transaction hash: ${safeTxHash}`)
        let transactionHash
        const network = await this.provider.getNetwork()
        const networkId = network.chainId
        // poll for safe tx data
        while (!transactionHash) {
          try {
            const safeTransaction = await getBySafeTx(networkId, safeTxHash)
            if (safeTransaction.transactionHash) {
              transactionHash = safeTransaction.transactionHash
            }
          } catch (e) {
            logger.log(`getBySafeTxHash: ${e.message}`)
          }
          await waitABit()
        }
        logger.log(`Transaction hash: ${transactionHash}`)
        transactionReceipt = await this.provider.waitForTransaction(transactionHash)
      } else {
        // if threshold is > 1 the tx needs more sigs, return dummy tx receipt
        return fallbackMultisigTransactionReceipt
      }
    }
    // wait for subgraph to sync tx
    if (transactionReceipt.blockNumber) {
      const network = await this.provider.getNetwork()
      await waitForBlockToSync(network.chainId, transactionReceipt.blockNumber)
    }
    return transactionReceipt
  }

  execTransactions = async (
    transactions: Transaction[],
    txOptions?: TxOptions,
    setTxHash?: (arg0: string) => void,
    setTxState?: (step: TransactionStep) => void,
  ) => {
    if (this.cpk.relay) {
      // pay tx fee
      transactions.push({
        to: RELAY_ADDRESS,
        value: RELAY_FEE,
      })
    }

    const txObject = await this.cpk.execTransactions(transactions, txOptions)
    setTxState && setTxState(TransactionStep.transactionSubmitted)
    setTxHash && setTxHash(txObject.hash)
    const tx = await this.waitForTransaction(txObject)
    setTxState && setTxState(TransactionStep.transactionConfirmed)
    return tx
  }

  getGas = async (txOptions: TxOptions): Promise<void> => {
    const network = await this.provider.getNetwork()
    const networkId = network.chainId
    if (networkId === networkIds.XDAI || this.isSafeApp) {
      txOptions.gas = defaultGas
    }
  }

  buyOutcomes = async ({
    amount,
    collateral,
    compoundService,
    marketMaker,
    outcomeIndex,
    setTxHash,
    setTxState,
    useBaseToken = false,
  }: CPKBuyOutcomesParams): Promise<TransactionReceipt> => {
    try {
      const signer = this.provider.getSigner()
      const account = await signer.getAddress()
      const network = await this.provider.getNetwork()
      const networkId = network.chainId

      const transactions: Transaction[] = []

      const txOptions: TxOptions = {}
      await this.getGas(txOptions)

      const buyAmount = this.cpk.relay ? amount.sub(RELAY_FEE) : amount

      let collateralAddress
      let collateralSymbol = ''
      let userInputCollateralSymbol: KnownToken
      let userInputCollateral: Token = collateral
      let minCollateralAmount = buyAmount
      if (useBaseToken && compoundService != null) {
        collateralSymbol = collateral.symbol.toLowerCase()
        if (collateralSymbol === 'ceth') {
          userInputCollateral = getNativeAsset(networkId)
        } else {
          userInputCollateralSymbol = collateralSymbol.substring(1, collateralSymbol.length) as KnownToken
          userInputCollateral = getToken(networkId, userInputCollateralSymbol)
        }
        minCollateralAmount = compoundService.calculateBaseToCTokenExchange(userInputCollateral, buyAmount)
      }
      if (collateral.address === pseudoNativeAssetAddress) {
        // ultimately WETH will be the collateral if we fund with native ether
        collateralAddress = getWrapToken(networkId).address

        // we need to send the funding amount in native ether
        if (!this.isSafeApp) {
          txOptions.value = buyAmount
        }

        // Step 0: Wrap ether
        transactions.push({
          to: collateralAddress,
          value: buyAmount.toString(),
        })
      } else if (useBaseToken) {
        if (userInputCollateral.address === pseudoNativeAssetAddress) {
          // If base token is ETH then we don't need to transfer to cpk
          if (!this.isSafeApp) {
            txOptions.value = buyAmount
          }
          const encodedMintFunction = CompoundService.encodeMintTokens(collateralSymbol, buyAmount.toString())
          transactions.push({
            to: collateral.address,
            data: encodedMintFunction,
            value: buyAmount.toString(),
          })
        } else {
          // Transfer the base token to cpk
          // Mint cTokens in the cpk
          transactions.push({
            to: userInputCollateral.address,
            data: ERC20Service.encodeTransferFrom(account, this.cpk.address, buyAmount),
          })
          const encodedMintFunction = CompoundService.encodeMintTokens(collateralSymbol, buyAmount.toString())
          // Approve cToken for the cpk contract
          transactions.push({
            to: userInputCollateral.address,
            data: ERC20Service.encodeApproveUnlimited(collateral.address),
          })
          // Mint ctokens from the underlying token
          transactions.push({
            to: collateral.address,
            data: encodedMintFunction,
          })
        }
        collateralAddress = await marketMaker.getCollateralToken()
      } else {
        collateralAddress = await marketMaker.getCollateralToken()
      }
      const marketMakerAddress = marketMaker.address
      const collateralService = new ERC20Service(this.provider, account, collateralAddress)
      logger.log(`CPK address: ${this.cpk.address}`)
      const outcomeTokensToBuy = await marketMaker.calcBuyAmount(minCollateralAmount, outcomeIndex)
      logger.log(`Min outcome tokens to buy: ${outcomeTokensToBuy}`)

      // Check  if the allowance of the CPK to the market maker is enough.
      const hasCPKEnoughAlowance = await collateralService.hasEnoughAllowance(
        this.cpk.address,
        marketMakerAddress,
        minCollateralAmount,
      )

      if (!hasCPKEnoughAlowance) {
        // Step 1:  Approve unlimited amount to be transferred to the market maker)
        transactions.push({
          to: collateralAddress,
          data: ERC20Service.encodeApproveUnlimited(marketMakerAddress),
        })
      }

      // Step 2: Transfer the amount of collateral being spent from the user to the CPK
      // If we are funding with native ether we can skip this step
      // If we are signed in as a safe we don't need to transfer
      if (!this.isSafeApp && collateral.address !== pseudoNativeAssetAddress && !useBaseToken) {
        // Step 2: Transfer the amount of collateral being spent from the user to the CPK
        transactions.push({
          to: collateralAddress,
          data: ERC20Service.encodeTransferFrom(account, this.cpk.address, buyAmount),
        })
      }
      // Step 3: Buy outcome tokens with the CPK
      transactions.push({
        to: marketMakerAddress,
        data: MarketMakerService.encodeBuy(minCollateralAmount, outcomeIndex, outcomeTokensToBuy),
      })

      return this.execTransactions(transactions, txOptions, setTxHash, setTxState)
    } catch (err) {
      logger.error(`There was an error buying '${amount.toString()}' of shares`, err.message)
      throw err
    }
  }

  createMarket = async ({
    compoundService,
    compoundTokenDetails,
    conditionalTokens,
    marketData,
    marketMakerFactory,
    realitio,
    setTxHash,
    setTxState,
    useCompoundReserve,
  }: CPKCreateMarketParams): Promise<CreateMarketResult> => {
    try {
      const {
        arbitrator,
        category,
        loadedQuestionId,
        outcomes,
        question,
        resolution,
        spread,
        userInputCollateral,
      } = marketData

      if (!resolution) {
        throw new Error('Resolution time was not specified')
      }

      const signer = this.provider.getSigner()
      const account = await signer.getAddress()

      const network = await this.provider.getNetwork()
      const networkId = network.chainId

      const conditionalTokensAddress = conditionalTokens.address
      const realitioAddress = realitio.address

      const openingDateMoment = moment(resolution)

      const transactions: Transaction[] = []
      const txOptions: TxOptions = {}
      await this.getGas(txOptions)

      let collateral
      const fundingAmount = this.cpk.relay ? marketData.funding.sub(RELAY_FEE) : marketData.funding
      if (marketData.collateral.address === pseudoNativeAssetAddress && !useCompoundReserve) {
        // ultimately WETH will be the collateral if we fund with native ether
        collateral = getWrapToken(networkId)

        // we need to send the funding amount in native ether
        if (!this.isSafeApp) {
          txOptions.value = fundingAmount
        }

        // Step 0: Wrap ether
        transactions.push({
          to: collateral.address,
          value: fundingAmount.toString(),
        })
      } else if (useCompoundReserve && compoundTokenDetails) {
        if (userInputCollateral.address === pseudoNativeAssetAddress) {
          // If user chosen collateral is ETH
          collateral = marketData.collateral
          if (!this.isSafeApp) {
            txOptions.value = fundingAmount
          }
          const encodedMintFunction = CompoundService.encodeMintTokens(
            compoundTokenDetails.symbol,
            fundingAmount.toString(),
          )
          transactions.push({
            to: collateral.address,
            data: encodedMintFunction,
            value: fundingAmount.toString(),
          })
        } else {
          collateral = marketData.collateral
          // For any other compound pair that is not ETH
          const encodedMintFunction = CompoundService.encodeMintTokens(
            compoundTokenDetails.symbol,
            fundingAmount.toString(),
          )
          // Transfer user input collateral to cpk
          transactions.push({
            to: userInputCollateral.address,
            data: ERC20Service.encodeTransferFrom(account, this.cpk.address, fundingAmount),
          })
          // Approve cToken for the cpk contract
          transactions.push({
            to: userInputCollateral.address,
            data: ERC20Service.encodeApproveUnlimited(collateral.address),
          })
          // Mint ctokens from the underlying token
          transactions.push({
            to: collateral.address,
            data: encodedMintFunction,
          })
        }
      } else {
        collateral = marketData.collateral
      }

      let questionId: string
      if (loadedQuestionId) {
        questionId = loadedQuestionId
      } else {
        // Step 1: Create question in realitio
        transactions.push({
          to: realitioAddress,
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
          this.cpk.address,
        )
      }
      logger.log(`QuestionID ${questionId}`)

      const oracleAddress = getContractAddress(networkId, 'oracle')
      const conditionId = conditionalTokens.getConditionId(questionId, oracleAddress, outcomes.length)

      let conditionExists = false
      if (loadedQuestionId) {
        conditionExists = await conditionalTokens.doesConditionExist(conditionId)
      }

      if (!conditionExists) {
        // Step 2: Prepare condition
        logger.log(`Adding prepareCondition transaction`)

        transactions.push({
          to: conditionalTokensAddress,
          data: ConditionalTokenService.encodePrepareCondition(questionId, oracleAddress, outcomes.length),
        })
      }

      logger.log(`ConditionID: ${conditionId}`)

      // Step 3: Approve collateral for factory
      transactions.push({
        to: collateral.address,
        data: ERC20Service.encodeApproveUnlimited(marketMakerFactory.address),
      })
      let minCollateralAmount = fundingAmount
      if (useCompoundReserve && compoundService) {
        minCollateralAmount = compoundService.calculateBaseToCTokenExchange(userInputCollateral, fundingAmount)
      }
      // Step 4: Transfer funding from user
      // If we are funding with native ether we can skip this step
      // If we are signed in as a safe we don't need to transfer
      if (!this.isSafeApp && marketData.collateral.address !== pseudoNativeAssetAddress) {
        // If we are using compound reserve then we don't need to transfer
        // since we have already transferred the userinput collateral and minted cTokens
        if (!useCompoundReserve) {
          transactions.push({
            to: collateral.address,
            data: ERC20Service.encodeTransferFrom(account, this.cpk.address, fundingAmount),
          })
        }
      }
      // Step 5: Create market maker
      const saltNonce = Math.round(Math.random() * 1000000)
      const predictedMarketMakerAddress = await marketMakerFactory.predictMarketMakerAddress(
        saltNonce,
        conditionalTokens.address,
        collateral.address,
        conditionId,
        this.cpk.address,
        spread,
      )
      logger.log(`Predicted market maker address: ${predictedMarketMakerAddress}`)
      const distributionHint = calcDistributionHint(marketData.outcomes.map(o => o.probability))
      transactions.push({
        to: marketMakerFactory.address,
        data: MarketMakerFactoryService.encodeCreateMarketMaker(
          saltNonce,
          conditionalTokens.address,
          collateral.address,
          conditionId,
          spread,
          minCollateralAmount,
          distributionHint,
        ),
      })

      const transaction = await this.execTransactions(transactions, txOptions, setTxHash, setTxState)
      return {
        transaction,
        marketMakerAddress: predictedMarketMakerAddress,
      }
    } catch (err) {
      logger.error(`There was an error creating the market maker`, err.message)
      throw err
    }
  }

  createScalarMarket = async ({
    compoundService,
    compoundTokenDetails,
    conditionalTokens,
    marketData,
    marketMakerFactory,
    realitio,
    setTxHash,
    setTxState,
    useCompoundReserve,
  }: CPKCreateMarketParams): Promise<CreateMarketResult> => {
    try {
      const {
        arbitrator,
        category,
        loadedQuestionId,
        lowerBound,
        question,
        resolution,
        spread,
        startingPoint,
        unit,
        upperBound,
        userInputCollateral,
      } = marketData

      if (!resolution) {
        throw new Error('Resolution time was not specified')
      }

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

      const signer = this.provider.getSigner()
      const account = await signer.getAddress()

      const network = await this.provider.getNetwork()
      const networkId = network.chainId

      const conditionalTokensAddress = conditionalTokens.address
      const realitioAddress = realitio.address
      const realitioScalarAdapterAddress = realitio.scalarContract.address

      const openingDateMoment = moment(resolution)

      const transactions: Transaction[] = []
      const txOptions: TxOptions = {}
      await this.getGas(txOptions)

      let collateral

      const fundingAmount = this.cpk.relay ? marketData.funding.sub(RELAY_FEE) : marketData.funding

      if (marketData.collateral.address === pseudoNativeAssetAddress) {
        // ultimately WETH will be the collateral if we fund with native ether
        collateral = getWrapToken(networkId)

        // we need to send the funding amount in native ether
        if (!this.isSafeApp) {
          txOptions.value = fundingAmount
        }

        // Step 0: Wrap ether
        transactions.push({
          to: collateral.address,
          value: fundingAmount.toString(),
        })
      } else if (useCompoundReserve && compoundTokenDetails) {
        if (userInputCollateral.address === pseudoNativeAssetAddress) {
          // If user chosen collateral is ETH
          collateral = marketData.collateral
          if (!this.cpk.isSafeApp()) {
            txOptions.value = marketData.funding
          }
          const encodedMintFunction = CompoundService.encodeMintTokens(
            compoundTokenDetails.symbol,
            marketData.funding.toString(),
          )
          transactions.push({
            to: collateral.address,
            data: encodedMintFunction,
            value: fundingAmount.toString(),
          })
        } else {
          collateral = marketData.collateral
          // For any other compound pair that is not ETH
          const encodedMintFunction = CompoundService.encodeMintTokens(
            compoundTokenDetails.symbol,
            marketData.funding.toString(),
          )
          // Transfer user input collateral to cpk
          transactions.push({
            to: userInputCollateral.address,
            data: ERC20Service.encodeTransferFrom(account, this.cpk.address, marketData.funding),
          })
          // Approve cToken for the cpk contract
          transactions.push({
            to: userInputCollateral.address,
            data: ERC20Service.encodeApproveUnlimited(collateral.address),
          })
          // Mint ctokens from the underlying token
          transactions.push({
            to: collateral.address,
            data: encodedMintFunction,
          })
        }
      } else {
        collateral = marketData.collateral
      }

      let realityEthQuestionId: string
      if (loadedQuestionId) {
        realityEthQuestionId = loadedQuestionId
      } else {
        // Step 1: Create question in realitio without bounds
        transactions.push({
          to: realitioAddress,
          data: RealitioService.encodeAskScalarQuestion(
            question,
            unit,
            category,
            arbitrator.address,
            openingDateMoment,
            networkId,
          ),
        })
        realityEthQuestionId = await realitio.askScalarQuestionConstant(
          question,
          unit,
          category,
          arbitrator.address,
          openingDateMoment,
          networkId,
          this.cpk.address,
        )
      }
      const conditionQuestionId = keccak256(
        defaultAbiCoder.encode(['bytes32', 'uint256', 'uint256'], [realityEthQuestionId, lowerBound, upperBound]),
      )
      logger.log(`Reality.eth QuestionID ${realityEthQuestionId}`)
      logger.log(`Conditional Tokens QuestionID ${conditionQuestionId}`)

      // Step 1.5: Announce the questionId and its bounds to the RealitioScalarAdapter
      transactions.push({
        to: realitioScalarAdapterAddress,
        data: RealitioService.encodeAnnounceConditionQuestionId(realityEthQuestionId, lowerBound, upperBound),
      })

      const oracleAddress = getContractAddress(networkId, 'realitioScalarAdapter')
      const conditionId = conditionalTokens.getConditionId(conditionQuestionId, oracleAddress, 2)

      let conditionExists = false
      if (loadedQuestionId) {
        conditionExists = await conditionalTokens.doesConditionExist(conditionId)
      }

      if (!conditionExists) {
        // Step 2: Prepare scalar condition using the conditionQuestionId
        logger.log(`Adding prepareCondition transaction`)

        transactions.push({
          to: conditionalTokensAddress,
          data: ConditionalTokenService.encodePrepareCondition(conditionQuestionId, oracleAddress, 2),
        })
      }

      logger.log(`ConditionID: ${conditionId}`)

      // Step 3: Approve collateral for factory
      transactions.push({
        to: collateral.address,
        data: ERC20Service.encodeApproveUnlimited(marketMakerFactory.address),
      })

      // Step 4: Transfer funding from user
      // If we are funding with native ether we can skip this step
      // If we are signed in as a safe we don't need to transfer
      let minCollateralAmount = fundingAmount
      if (useCompoundReserve && compoundService) {
        minCollateralAmount = compoundService.calculateBaseToCTokenExchange(userInputCollateral, fundingAmount)
      }
      if (!this.isSafeApp && marketData.collateral.address !== pseudoNativeAssetAddress) {
        if (!useCompoundReserve) {
          transactions.push({
            to: collateral.address,
            data: ERC20Service.encodeTransferFrom(account, this.cpk.address, fundingAmount),
          })
        }
      }

      // Step 4.5: Calculate distributionHint
      const domainSize = upperBound.sub(lowerBound)
      const a = clampBigNumber(upperBound.sub(startingPoint), Zero, domainSize)
      const b = clampBigNumber(startingPoint.sub(lowerBound), Zero, domainSize)

      const distributionHint = [b, a]

      // Step 5: Create market maker
      const saltNonce = Math.round(Math.random() * 1000000)
      const predictedMarketMakerAddress = await marketMakerFactory.predictMarketMakerAddress(
        saltNonce,
        conditionalTokens.address,
        collateral.address,
        conditionId,
        this.cpk.address,
        spread,
      )
      logger.log(`Predicted market maker address: ${predictedMarketMakerAddress}`)
      transactions.push({
        to: marketMakerFactory.address,
        data: MarketMakerFactoryService.encodeCreateMarketMaker(
          saltNonce,
          conditionalTokens.address,
          collateral.address,
          conditionId,
          spread,
          minCollateralAmount,
          distributionHint,
        ),
      })

      const transaction = await this.execTransactions(transactions, txOptions, setTxHash, setTxState)

      return {
        transaction,
        marketMakerAddress: predictedMarketMakerAddress,
      }
    } catch (err) {
      logger.error(`There was an error creating the market maker`, err.message)
      throw err
    }
  }

  sellOutcomes = async ({
    amount,
    collateralToken,
    compoundService,
    conditionalTokens,
    marketMaker,
    outcomeIndex,
    setTxHash,
    setTxState,
    useBaseToken,
  }: CPKSellOutcomesParams): Promise<TransactionReceipt> => {
    try {
      const signer = this.provider.getSigner()
      const account = await signer.getAddress()
      const network = await this.provider.getNetwork()
      const networkId = network.chainId

      const outcomeTokensToSell = await marketMaker.calcSellAmount(amount, outcomeIndex)
      const collateralAddress = await marketMaker.getCollateralToken()

      const transactions: Transaction[] = []
      const txOptions: TxOptions = {}
      await this.getGas(txOptions)

      const collateralSymbol = collateralToken.symbol.toLowerCase()
      let userInputCollateral = collateralToken
      if (compoundService && useBaseToken) {
        if (collateralSymbol === 'ceth') {
          userInputCollateral = getNativeAsset(networkId)
        } else {
          const userInputCollateralSymbol = collateralSymbol.substring(1, collateralSymbol.length) as KnownToken
          userInputCollateral = getToken(networkId, userInputCollateralSymbol)
        }
      }

      const isAlreadyApprovedForMarketMaker = await conditionalTokens.isApprovedForAll(
        this.cpk.address,
        marketMaker.address,
      )

      if (!isAlreadyApprovedForMarketMaker) {
        transactions.push({
          to: conditionalTokens.address,
          data: ConditionalTokenService.encodeSetApprovalForAll(marketMaker.address, true),
        })
      }

      transactions.push({
        to: marketMaker.address,
        data: MarketMakerService.encodeSell(amount, outcomeIndex, outcomeTokensToSell),
      })

      if (useBaseToken || this.cpk.relay) {
        if (!compoundService) {
          // Pseudonative to base token conversion flow
          const collateralToken = getTokenFromAddress(networkId, collateralAddress)
          const encodedWithdrawFunction = UnwrapTokenService.withdrawAmount(collateralToken.symbol, amount)
          // If use prefers to get paid in the base native asset then unwrap the asset
          transactions.push({
            to: collateralAddress,
            data: encodedWithdrawFunction,
          })
        } else {
          // Convert cpk token to base token if user wants to redeem in base
          const encodedRedeemFunction = CompoundService.encodeRedeemTokens(collateralSymbol, amount.toString())
          // Approve cToken for the cpk contract
          transactions.push({
            to: userInputCollateral.address,
            data: ERC20Service.encodeApproveUnlimited(collateralToken.address),
          })
          // Redeem underlying token from the ctoken
          transactions.push({
            to: collateralToken.address,
            data: encodedRedeemFunction,
          })
        }
      }
      // If we are signed in as a safe we don't need to transfer
      if (!this.isSafeApp) {
        // Step 4: Transfer funding to user
        if (!useBaseToken) {
          transactions.push({
            to: userInputCollateral.address,
            data: ERC20Service.encodeTransfer(account, amount),
          })
        } else {
          // Transfer unwrapped asset back to user
          if (compoundService && userInputCollateral.address !== pseudoNativeAssetAddress) {
            const minCollateralAmount = compoundService.calculateCTokenToBaseExchange(userInputCollateral, amount)
            transactions.push({
              to: userInputCollateral.address,
              data: ERC20Service.encodeTransfer(account, minCollateralAmount),
            })
          } else {
            transactions.push({
              to: account,
              value: amount.toString(),
            })
          }
        }
      }

      return this.execTransactions(transactions, txOptions, setTxHash, setTxState)
    } catch (err) {
      logger.error(`There was an error selling '${amount.toString()}' of shares`, err.message)
      throw err
    }
  }

  addFunding = async ({
    amount,
    collateral,
    compoundService,
    marketMaker,
    setTxHash,
    setTxState,
    useBaseToken,
  }: CPKAddFundingParams): Promise<TransactionReceipt> => {
    try {
      const signer = this.provider.getSigner()
      const account = await signer.getAddress()

      const network = await this.provider.getNetwork()
      const networkId = network.chainId

      const transactions: Transaction[] = []

      const txOptions: TxOptions = {}
      await this.getGas(txOptions)

      let collateralSymbol = ''
      let userInputCollateralSymbol: KnownToken
      let userInputCollateral: Token = collateral

      let collateralAddress

      const fundingAmount = this.cpk.relay ? amount.sub(RELAY_FEE) : amount

      if (collateral.address === pseudoNativeAssetAddress) {
        // ultimately WETH will be the collateral if we fund with native ether
        collateralAddress = getWrapToken(networkId).address

        // we need to send the funding amount in native ether
        if (!this.isSafeApp) {
          txOptions.value = fundingAmount
        }

        // Step 0: Wrap ether
        transactions.push({
          to: collateralAddress,
          value: fundingAmount.toString(),
        })
      } else {
        collateralAddress = collateral.address
      }
      const collateralService = new ERC20Service(this.provider, account, collateralAddress)
      // Check  if the allowance of the CPK to the market maker is enough.
      const hasCPKEnoughAlowance = await collateralService.hasEnoughAllowance(
        this.cpk.address,
        marketMaker.address,
        fundingAmount,
      )
      if (!hasCPKEnoughAlowance) {
        // Step 1:  Approve unlimited amount to be transferred to the market maker
        transactions.push({
          to: collateralAddress,
          data: ERC20Service.encodeApproveUnlimited(marketMaker.address),
        })
      }
      let minCollateralAmount = fundingAmount
      if (useBaseToken && compoundService != null) {
        collateralSymbol = collateral.symbol.toLowerCase()
        if (collateralSymbol === 'ceth') {
          userInputCollateral = getNativeAsset(networkId)
        } else {
          userInputCollateralSymbol = collateralSymbol.substring(1, collateralSymbol.length) as KnownToken
          userInputCollateral = getToken(networkId, userInputCollateralSymbol)
        }
        minCollateralAmount = compoundService.calculateBaseToCTokenExchange(userInputCollateral, fundingAmount)
      }
      // If we are signed in as a safe we don't need to transfer
      if (!this.isSafeApp && collateral.address !== pseudoNativeAssetAddress) {
        // Step 4: Transfer funding from user
        if (useBaseToken) {
          // If use base token then transfer the base token amount from the user
          if (collateral.address !== pseudoNativeAssetAddress) {
            transactions.push({
              to: userInputCollateral.address,
              data: ERC20Service.encodeTransferFrom(account, this.cpk.address, fundingAmount),
            })
          }
        } else {
          // If use collateral token then transfer the collateral token amount from the user
          transactions.push({
            to: collateral.address,
            data: ERC20Service.encodeTransferFrom(account, this.cpk.address, minCollateralAmount),
          })
        }
      }
      if (useBaseToken) {
        // get base token
        const encodedMintFunction = CompoundService.encodeMintTokens(collateralSymbol, fundingAmount.toString())
        // Approve cToken for the cpk contract
        if (userInputCollateral.address === pseudoNativeAssetAddress) {
          if (!this.isSafeApp) {
            txOptions.value = fundingAmount
          }
          transactions.push({
            to: collateral.address,
            data: encodedMintFunction,
            value: fundingAmount.toString(),
          })
        } else {
          transactions.push({
            to: userInputCollateral.address,
            data: ERC20Service.encodeApproveUnlimited(collateral.address),
          })
          // Mint ctokens from the underlying token
          transactions.push({
            to: collateral.address,
            data: encodedMintFunction,
          })
        }
      }
      // Step 3: Add funding to market
      transactions.push({
        to: marketMaker.address,
        data: MarketMakerService.encodeAddFunding(minCollateralAmount),
      })

      return this.execTransactions(transactions, txOptions, setTxHash, setTxState)
    } catch (err) {
      logger.error(`There was an error adding an amount of '${amount.toString()}' for funding`, err.message)
      throw err
    }
  }

  removeFunding = async ({
    amountToMerge,
    collateralAddress,
    compoundService,
    conditionId,
    conditionalTokens,
    earnings,
    marketMaker,
    outcomesCount,
    setTxHash,
    setTxState,
    sharesToBurn,
    useBaseToken,
  }: CPKRemoveFundingParams): Promise<TransactionReceipt> => {
    try {
      const signer = this.provider.getSigner()
      const account = await signer.getAddress()
      const network = await this.provider.getNetwork()
      const networkId = network.chainId
      const transactions: Transaction[] = []
      const removeFundingTx = {
        to: marketMaker.address,
        data: MarketMakerService.encodeRemoveFunding(sharesToBurn),
      }

      const mergePositionsTx = {
        to: conditionalTokens.address,
        data: ConditionalTokenService.encodeMergePositions(
          collateralAddress,
          conditionId,
          outcomesCount,
          amountToMerge,
        ),
      }
      transactions.push(removeFundingTx)
      transactions.push(mergePositionsTx)

      const txOptions: TxOptions = {}
      await this.getGas(txOptions)

      const collateralToken = getTokenFromAddress(networkId, collateralAddress)
      const collateralSymbol = collateralToken.symbol.toLowerCase()
      let userInputCollateral = collateralToken
      const totalAmountToSend = amountToMerge.add(earnings)
      // transfer to the user the merged collateral plus the earned fees
      if (useBaseToken || this.cpk.relay) {
        if (compoundService != null) {
          // cToken to base token flow
          if (collateralSymbol === 'ceth') {
            userInputCollateral = getNativeAsset(networkId)
          } else {
            const userInputCollateralSymbol = getBaseTokenForCToken(collateralSymbol) as KnownToken
            userInputCollateral = getToken(networkId, userInputCollateralSymbol)
          }
          // Convert cpk token to base token if user wants to redeem in base
          const encodedRedeemFunction = CompoundService.encodeRedeemTokens(
            collateralSymbol,
            totalAmountToSend.toString(),
          )
          // Approve cToken for the cpk contract
          transactions.push({
            to: userInputCollateral.address,
            data: ERC20Service.encodeApproveUnlimited(collateralToken.address),
          })
          // redeeem underlying token from the ctoken token
          transactions.push({
            to: collateralToken.address,
            data: encodedRedeemFunction,
          })
        } else {
          // Pseudonative asset to base asset flow
          const collateralToken = getTokenFromAddress(networkId, collateralAddress)
          const encodedWithdrawFunction = UnwrapTokenService.withdrawAmount(collateralToken.symbol, totalAmountToSend)
          // If use prefers to get paid in the base native asset then unwrap the asset
          transactions.push({
            to: collateralAddress,
            data: encodedWithdrawFunction,
          })
        }
      }
      // If we are signed in as a safe we don't need to transfer
      if (!this.isSafeApp) {
        // transfer to the user the merged collateral plus the earned fees
        if (useBaseToken) {
          if (compoundService != null) {
            const minCollateralAmount = compoundService.calculateCTokenToBaseExchange(
              userInputCollateral,
              totalAmountToSend,
            )
            if (userInputCollateral.address === pseudoNativeAssetAddress) {
              // If user wants to redeem in ether simply transfer the funds back to user
              transactions.push({
                to: account,
                value: minCollateralAmount.toString(),
              })
            } else {
              // Transfer base token to the user
              transactions.push({
                to: userInputCollateral.address,
                data: ERC20Service.encodeTransfer(account, minCollateralAmount),
              })
            }
          } else {
            // Transfer unwrapped asset back to user
            transactions.push({
              to: account,
              value: totalAmountToSend.toString(),
            })
          }
        } else {
          transactions.push({
            to: collateralAddress,
            data: ERC20Service.encodeTransfer(account, totalAmountToSend),
          })
        }
      }

      return this.execTransactions(transactions, txOptions, setTxHash, setTxState)
    } catch (err) {
      logger.error(`There was an error removing amount '${sharesToBurn.toString()}' for funding`, err.message)
      throw err
    }
  }

  requestVerification = async ({
    ovmAddress,
    params,
    submissionDeposit,
  }: CPKRequestVerificationParams): Promise<TransactionReceipt> => {
    try {
      const signer = this.provider.getSigner()
      const ovm = new OvmService()
      const contractInstance = await ovm.createOvmContractInstance(signer, ovmAddress)

      const txObject = await ovm.generateTransaction(params, contractInstance, submissionDeposit)

      return this.waitForTransaction(txObject)
    } catch (err) {
      logger.error('Error while requesting market verification via Kleros!', err.message)
      throw err
    }
  }

  redeemPositions = async ({
    collateralToken,
    conditionalTokens,
    earnedCollateral,
    isConditionResolved,
    marketMaker,
    numOutcomes,
    oracle,
    question,
    setTxHash,
    setTxState,
  }: CPKRedeemParams): Promise<TransactionReceipt> => {
    try {
      const signer = this.provider.getSigner()
      const account = await signer.getAddress()
      const network = await this.provider.getNetwork()
      const networkId = network.chainId

      const transactions: Transaction[] = []
      const txOptions: TxOptions = {}
      await this.getGas(txOptions)

      if (!isConditionResolved) {
        transactions.push({
          to: oracle.address,
          data: OracleService.encodeResolveCondition(question.id, question.templateId, question.raw, numOutcomes),
        })
      }

      const conditionId = await marketMaker.getConditionId()

      transactions.push({
        to: conditionalTokens.address,
        data: ConditionalTokenService.encodeRedeemPositions(collateralToken.address, conditionId, numOutcomes),
      })

      let earnings = earnedCollateral
      let token = collateralToken

      if (isCToken(collateralToken.symbol)) {
        const compound = new CompoundService(collateralToken.address, collateralToken.symbol, this.provider, account)
        await compound.init()

        // Convert compound token to base token
        const encodedRedeemFunction = CompoundService.encodeRedeemTokens(
          collateralToken.symbol,
          earnedCollateral.toString(),
        )

        // Redeeem underlying token
        transactions.push({
          to: collateralToken.address,
          data: encodedRedeemFunction,
        })

        token = getBaseToken(networkId, collateralToken.symbol)
        earnings = compound.calculateCTokenToBaseExchange(token, earnedCollateral)
      }

      const wrapToken = getWrapToken(networkId)
      const nativeAsset = getNativeAsset(networkId)

      if (token.address === wrapToken.address && earnings) {
        // unwrap token
        const encodedWithdrawFunction = UnwrapTokenService.withdrawAmount(token.symbol, earnings)
        transactions.push({
          to: token.address,
          data: encodedWithdrawFunction,
        })
        token = nativeAsset
      }

      // If we are signed in as a safe we don't need to transfer
      if (!this.isSafeApp && earnings) {
        if (token.address === nativeAsset.address) {
          transactions.push({
            to: account,
            value: earnings.toString(),
          })
        } else {
          transactions.push({
            to: token.address,
            data: ERC20Service.encodeTransfer(account, earnings),
          })
        }
      }

      return this.execTransactions(transactions, txOptions, setTxHash, setTxState)
    } catch (err) {
      logger.error(`Error trying to resolve condition or redeem for question id '${question.id}'`, err.message)
      throw err
    }
  }

  resolveCondition = async ({
    isScalar,
    numOutcomes,
    oracle,
    question,
    realitio,
    scalarHigh,
    scalarLow,
    setTxHash,
    setTxState,
  }: CPKResolveParams) => {
    try {
      const transactions: Transaction[] = []
      const txOptions: TxOptions = {}
      await this.getGas(txOptions)

      if (isScalar && scalarLow && scalarHigh) {
        transactions.push({
          to: realitio.scalarContract.address,
          data: RealitioService.encodeResolveCondition(question.id, question.raw, scalarLow, scalarHigh),
        })
      } else {
        transactions.push({
          to: oracle.address,
          data: OracleService.encodeResolveCondition(question.id, question.templateId, question.raw, numOutcomes),
        })
      }
      return this.execTransactions(transactions, txOptions, setTxHash, setTxState)
    } catch (err) {
      logger.error(`There was an error resolving the condition with question id '${question.id}'`, err.message)
      throw err
    }
  }

  submitAnswer = async ({ amount, answer, question, realitio, setTxHash, setTxState }: CPKSubmitAnswerParams) => {
    try {
      if (this.cpk.relay || this.isSafeApp) {
        const transactions: Transaction[] = [
          {
            to: realitio.address,
            data: RealitioService.encodeSubmitAnswer(question.id, answer),
            value: amount.toString(),
          },
        ]
        const txOptions: TxOptions = {}
        await this.getGas(txOptions)
        return this.execTransactions(transactions, txOptions, setTxHash, setTxState)
      }
      const txObject = await realitio.submitAnswer(question.id, answer, amount)
      setTxState && setTxState(TransactionStep.transactionSubmitted)
      setTxHash && setTxHash(txObject.hash)
      const tx = await this.waitForTransaction(txObject)
      setTxState && setTxState(TransactionStep.transactionConfirmed)
      return tx
    } catch (error) {
      logger.error(`There was an error submitting answer '${question.id}'`, error.message)
      throw error
    }
  }

  proxyIsUpToDate = async (): Promise<boolean> => {
    const network = await this.provider.getNetwork()
    if (network.chainId === networkIds.XDAI || this.isSafeApp) {
      return true
    }
    const deployed = await this.cpk.isProxyDeployed()
    if (deployed) {
      const implementation = await this.safe.getMasterCopy()
      if (implementation.toLowerCase() === getTargetSafeImplementation(network.chainId).toLowerCase()) {
        return true
      }
    }
    return false
  }

  upgradeProxyImplementation = async (): Promise<TransactionReceipt> => {
    try {
      const txOptions: TxOptions = {}
      const network = await this.provider.getNetwork()
      await this.getGas(txOptions)
      const targetGnosisSafeImplementation = getTargetSafeImplementation(network.chainId)
      const transactions: Transaction[] = [
        {
          to: this.cpk.address,
          data: this.safe.encodeChangeMasterCopy(targetGnosisSafeImplementation),
        },
      ]
      return this.execTransactions(transactions, txOptions)
    } catch (err) {
      logger.error(`Error trying to update proxy`, err.message)
      throw err
    }
  }
  approveCpk = async (addressToApprove: string, tokenAddress: string) => {
    try {
      const txOptions: TxOptions = {}
      txOptions.gas = defaultGas

      const transactions: Transaction[] = [
        {
          to: tokenAddress,
          data: ERC20Service.encodeApproveUnlimited(OMNI_BRIDGE_XDAI_ADDRESS),
        },
      ]
      return this.execTransactions(transactions)
    } catch (e) {
      logger.error(`Error while approving ERC20 Token to CPK address : `, e.message)
      throw e
    }
  }

  sendMainnetTokenToBridge = async (amount: BigNumber, currency?: ExchangeCurrency) => {
    try {
      if (this.cpk.relay) {
        const xDaiService = new XdaiService(this.provider)
        const contract = await xDaiService.generateXdaiBridgeContractInstance(currency)

        const sender = await this.cpk.ethLibAdapter.signer.signer.getAddress()

        const receiver = this.cpk.address

        // verify proxy address before deposit
        await verifyProxyAddress(sender, receiver, this.cpk)

        const transaction = await contract.relayTokens(
          currency === ExchangeCurrency.Omen ? GEN_TOKEN_ADDDRESS_TESTING : sender,
          receiver,
          amount,
        )
        return transaction.hash
      } else {
        const xDaiService = new XdaiService(this.provider)
        const contract = await xDaiService.generateErc20ContractInstance(currency)
        const transaction = await xDaiService.generateSendTransaction(amount, contract, currency)
        return transaction
      }
    } catch (e) {
      logger.error(`Error trying to send Dai to bridge address: `, e.message)
      throw e
    }
  }

  sendXdaiChainTokenToBridge = async (amount: BigNumber, currency?: ExchangeCurrency) => {
    try {
      if (this.cpk.relay) {
        const transactions: Transaction[] = []
        const txOptions: TxOptions = {}
        await this.getGas(txOptions)

        // get mainnet relay signer
        const to = await this.cpk.ethLibAdapter.signer.signer.getAddress()

        // relay to signer address on mainnet
        if (currency === ExchangeCurrency.Dai) {
          transactions.push({
            to: XDAI_TO_DAI_TOKEN_BRIDGE_ADDRESS,
            data: XdaiService.encodeRelayTokens(to),
            value: amount.toString(),
          })
          const { hash } = await this.cpk.execTransactions(transactions, txOptions)
          return hash
        } else {
          transactions.push({
            to: GEN_XDAI_ADDRESS_TESTING,
            data: XdaiService.encodeTokenBridgeTransfer(OMNI_BRIDGE_XDAI_ADDRESS, amount, to),
          })
          const { transactionHash } = await this.execTransactions(transactions, txOptions)

          return transactionHash
        }
      } else {
        const xDaiService = new XdaiService(this.provider)
        const transaction = await xDaiService.sendXdaiToBridge(amount)
        return transaction
      }
    } catch (e) {
      logger.error(`Error trying to send XDai to bridge address`, e.message)
      throw e
    }
  }

  fetchLatestUnclaimedTransactions = async () => {
    try {
      const xDaiService = new XdaiService(this.provider)
      const daiData = await xDaiService.fetchXdaiTransactionData()
      const omenData = await xDaiService.fetchOmniTransactionData()

      return daiData.concat(omenData)
    } catch (e) {
      logger.error('Error fetching xDai subgraph data', e.message)
      throw e
    }
  }

  claimAllTokens = async () => {
    try {
      const xDaiService = new XdaiService(this.provider)

      const transactions = await this.fetchLatestUnclaimedTransactions()

      const messages = []
      const signatures = []
      const addresses = []

      for (let i = 0; i < transactions.length; i++) {
        addresses.push(transactions[i].address)

        const message = transactions[i].message
        messages.push(message.content)
        const signature = signaturesFormatted(message.signatures)

        signatures.push(signature)
      }

      const txObject = await xDaiService.claim(addresses, messages, signatures)
      return txObject
    } catch (e) {
      logger.error(`Error trying to claim Dai tokens from xDai bridge`, e.message)
      throw e
    }
  }

  depositAndStake = async ({
    amount,
    campaignAddress,
    collateral,
    compoundService,
    holdingsBN,
    marketMaker,
    poolShareSupply,
    setTxHash,
    setTxState,
    useBaseToken,
  }: CPKDepositAndStakeParams) => {
    try {
      const signer = this.provider.getSigner()
      const account = await signer.getAddress()

      const network = await this.provider.getNetwork()
      const networkId = network.chainId

      const transactions: Transaction[] = []

      const txOptions: TxOptions = {}
      txOptions.gas = defaultGas

      let collateralSymbol = ''
      let userInputCollateralSymbol: KnownToken
      let userInputCollateral: Token = collateral

      let collateralAddress

      const fundingAmount = this.cpk.relay ? amount.sub(RELAY_FEE) : amount

      if (collateral.address === pseudoNativeAssetAddress) {
        // ultimately WETH will be the collateral if we fund with native ether
        collateralAddress = getWrapToken(networkId).address

        // we need to send the funding amount in native ether
        if (!this.isSafeApp) {
          txOptions.value = fundingAmount
        }

        // Step 0: Wrap ether
        transactions.push({
          to: collateralAddress,
          value: fundingAmount.toString(),
        })
      } else {
        collateralAddress = collateral.address
      }
      const collateralService = new ERC20Service(this.provider, account, collateralAddress)
      // Check  if the allowance of the CPK to the market maker is enough.
      const hasCPKEnoughAlowance = await collateralService.hasEnoughAllowance(
        this.cpk.address,
        marketMaker.address,
        fundingAmount,
      )
      if (!hasCPKEnoughAlowance) {
        // Step 1:  Approve unlimited amount to be transferred to the market maker
        transactions.push({
          to: collateralAddress,
          data: ERC20Service.encodeApproveUnlimited(marketMaker.address),
        })
      }
      let minCollateralAmount = fundingAmount
      if (useBaseToken && compoundService != null) {
        collateralSymbol = collateral.symbol.toLowerCase()
        if (collateralSymbol === 'ceth') {
          userInputCollateral = getNativeAsset(networkId)
        } else {
          userInputCollateralSymbol = collateralSymbol.substring(1, collateralSymbol.length) as KnownToken
          userInputCollateral = getToken(networkId, userInputCollateralSymbol)
        }
        minCollateralAmount = compoundService.calculateBaseToCTokenExchange(userInputCollateral, fundingAmount)
      }
      // If we are signed in as a safe we don't need to transfer
      if (!this.isSafeApp && collateral.address !== pseudoNativeAssetAddress) {
        // Step 2: Transfer funding from user
        if (useBaseToken) {
          // If use base token then transfer the base token amount from the user
          if (collateral.address !== pseudoNativeAssetAddress) {
            transactions.push({
              to: userInputCollateral.address,
              data: ERC20Service.encodeTransferFrom(account, this.cpk.address, fundingAmount),
            })
          }
        } else {
          // If use collateral token then transfer the collateral token amount from the user
          transactions.push({
            to: collateral.address,
            data: ERC20Service.encodeTransferFrom(account, this.cpk.address, minCollateralAmount),
          })
        }
      }
      if (useBaseToken) {
        // get base token
        const encodedMintFunction = CompoundService.encodeMintTokens(collateralSymbol, fundingAmount.toString())
        // Approve cToken for the cpk contract
        if (userInputCollateral.address === pseudoNativeAssetAddress) {
          if (!this.isSafeApp) {
            txOptions.value = fundingAmount
          }
          transactions.push({
            to: collateral.address,
            data: encodedMintFunction,
            value: fundingAmount.toString(),
          })
        } else {
          transactions.push({
            to: userInputCollateral.address,
            data: ERC20Service.encodeApproveUnlimited(collateral.address),
          })
          // Mint ctokens from the underlying token
          transactions.push({
            to: collateral.address,
            data: encodedMintFunction,
          })
        }
      }

      // Step 3: Add funding to market
      transactions.push({
        to: marketMaker.address,
        data: MarketMakerService.encodeAddFunding(minCollateralAmount),
      })

      // Calculate amount to stake
      // addedFunds * poolShareSupply / poolWeight
      const amountToStake = amount.mul(poolShareSupply).div(holdingsBN.reduce((a, b) => (a.gt(b) ? a : b)))

      const erc20Service = new ERC20Service(this.provider, this.cpk.address, marketMaker.address)
      const hasEnoughAllowance = await erc20Service.hasEnoughAllowance(this.cpk.address, campaignAddress, amountToStake)

      // Step 4: Approve pool tokens to be sent to campaign address if not already done
      if (!hasEnoughAllowance) {
        transactions.push({
          to: marketMaker.address,
          data: ERC20Service.encodeApproveUnlimited(campaignAddress),
        })
      }

      // Step 5: Stake pool tokens
      transactions.push({
        to: campaignAddress,
        data: StakingService.encodeStakePoolTokens(amountToStake),
      })

      return this.execTransactions(transactions, txOptions, setTxHash, setTxState)
    } catch (err) {
      logger.error(`There was an error depositing and staking liquidity`, err.message)
      throw err
    }
  }

  stakePoolTokens = async (amount: BigNumber, campaignAddress: string, marketMakerAddress: string) => {
    try {
      const transactions: Transaction[] = []
      const txOptions: TxOptions = {}
      txOptions.gas = defaultGas

      const erc20Service = new ERC20Service(this.provider, this.cpk.address, marketMakerAddress)
      const hasEnoughAllowance = await erc20Service.hasEnoughAllowance(this.cpk.address, campaignAddress, amount)

      // Approve pool tokens to be sent to campaign address if not already done
      if (!hasEnoughAllowance) {
        transactions.push({
          to: marketMakerAddress,
          data: ERC20Service.encodeApproveUnlimited(campaignAddress),
        })
      }

      // Stake pool tokens
      transactions.push({
        to: campaignAddress,
        data: StakingService.encodeStakePoolTokens(amount),
      })

      const txObject = await this.cpk.execTransactions(transactions, txOptions)
      return txObject.hash
    } catch (e) {
      logger.error('Failed to stake pool tokens', e.message)
      throw e
    }
  }

  unstakePoolTokens = async (amount: BigNumber, campaignAddress: string) => {
    try {
      const transactions: Transaction[] = []
      const txOptions: TxOptions = {}
      txOptions.gas = defaultGas

      transactions.push({
        to: campaignAddress,
        data: StakingService.encodeWithdrawStakedPoolTokens(amount),
      })

      const txObject = await this.cpk.execTransactions(transactions, txOptions)
      return txObject.hash
    } catch (e) {
      logger.error('Failed to withdraw staked pool tokens', e.message)
      throw e
    }
  }

  claimRewardTokens = async (
    campaignAddress: string,
    setTxHash: (arg0: string) => void,
    setTxState: (step: TransactionStep) => void,
  ) => {
    try {
      const signer = this.provider.getSigner()
      const account = await signer.getAddress()
      const network = await this.provider.getNetwork()
      const networkId = network.chainId

      const transactions: Transaction[] = []
      const txOptions: TxOptions = {}
      txOptions.gas = defaultGas

      transactions.push({
        to: campaignAddress,
        data: StakingService.encodeClaimAll(this.cpk.address),
      })

      // If relay used, keep reward tokens in relay
      if (!this.cpk.relay) {
        // Calculate amount to send from CPK to EOA
        // claimable rewards + unclaimed rewards (if any)
        const stakingService = new StakingService(this.provider, this.cpk.address, campaignAddress)
        const rewardTokens = await stakingService.getRewardTokens()
        const claimableRewards = await stakingService.getClaimableRewards(this.cpk.address)

        for (let i = 0; i < rewardTokens.length; i++) {
          const erc20Service = new ERC20Service(this.provider, this.cpk.address, rewardTokens[i])
          const unclaimedRewards = bigNumberify(await erc20Service.getCollateral(this.cpk.address))
          const totalRewardsAmount = claimableRewards[i].add(unclaimedRewards)

          const hasEnoughAllowance = await erc20Service.hasEnoughAllowance(
            this.cpk.address,
            account,
            totalRewardsAmount,
          )

          // Approve unlimited if not already done
          if (!hasEnoughAllowance) {
            transactions.push({
              to: rewardTokens[i],
              data: ERC20Service.encodeApproveUnlimited(account),
            })
          }

          // Transfer all rewards from cpk to EOA
          transactions.push({
            to: rewardTokens[i],
            data: ERC20Service.encodeTransfer(account, totalRewardsAmount),
          })
        }
      }

      return this.execTransactions(transactions, txOptions, setTxHash, setTxState)
    } catch (e) {
      logger.error('Failed to claim reward tokens', e.message)
      throw e
    }
  }

  unstakeClaimAndWithdraw = async ({
    amountToMerge,
    campaignAddress,
    collateralAddress,
    compoundService,
    conditionId,
    conditionalTokens,
    earnings,
    marketMaker,
    outcomesCount,
    setTxHash,
    setTxState,
    sharesToBurn,
    useBaseToken,
  }: CPKUnstakeClaimAndWithdrawParams): Promise<TransactionReceipt> => {
    try {
      const signer = this.provider.getSigner()
      const account = await signer.getAddress()
      const network = await this.provider.getNetwork()
      const networkId = network.chainId

      const transactions: Transaction[] = []

      transactions.push({
        to: campaignAddress,
        data: StakingService.encodeClaimAll(this.cpk.address),
      })

      transactions.push({
        to: campaignAddress,
        data: StakingService.encodeWithdrawStakedPoolTokens(sharesToBurn),
      })

      const removeFundingTx = {
        to: marketMaker.address,
        data: MarketMakerService.encodeRemoveFunding(sharesToBurn),
      }

      const mergePositionsTx = {
        to: conditionalTokens.address,
        data: ConditionalTokenService.encodeMergePositions(
          collateralAddress,
          conditionId,
          outcomesCount,
          amountToMerge,
        ),
      }
      transactions.push(removeFundingTx)
      transactions.push(mergePositionsTx)

      const txOptions: TxOptions = {}
      txOptions.gas = defaultGas

      const collateralToken = getTokenFromAddress(networkId, collateralAddress)
      const collateralSymbol = collateralToken.symbol.toLowerCase()
      let userInputCollateral = collateralToken
      const totalAmountToSend = amountToMerge.add(earnings)
      // transfer to the user the merged collateral plus the earned fees
      if (useBaseToken || this.cpk.relay) {
        if (compoundService != null) {
          // cToken to base token flow
          if (collateralSymbol === 'ceth') {
            userInputCollateral = getNativeAsset(networkId)
          } else {
            const userInputCollateralSymbol = getBaseTokenForCToken(collateralSymbol) as KnownToken
            userInputCollateral = getToken(networkId, userInputCollateralSymbol)
          }
          // Convert cpk token to base token if user wants to redeem in base
          const encodedRedeemFunction = CompoundService.encodeRedeemTokens(
            collateralSymbol,
            totalAmountToSend.toString(),
          )
          // Approve cToken for the cpk contract
          transactions.push({
            to: userInputCollateral.address,
            data: ERC20Service.encodeApproveUnlimited(collateralToken.address),
          })
          // redeeem underlying token from the ctoken token
          transactions.push({
            to: collateralToken.address,
            data: encodedRedeemFunction,
          })
        } else {
          // Pseudonative asset to base asset flow
          const collateralToken = getTokenFromAddress(networkId, collateralAddress)
          const encodedWithdrawFunction = UnwrapTokenService.withdrawAmount(collateralToken.symbol, totalAmountToSend)
          // If use prefers to get paid in the base native asset then unwrap the asset
          transactions.push({
            to: collateralAddress,
            data: encodedWithdrawFunction,
          })
        }
      }
      // If we are signed in as a safe we don't need to transfer
      if (!this.isSafeApp) {
        // transfer to the user the merged collateral plus the earned fees
        if (useBaseToken) {
          if (compoundService != null) {
            const minCollateralAmount = compoundService.calculateCTokenToBaseExchange(
              userInputCollateral,
              totalAmountToSend,
            )
            if (userInputCollateral.address === pseudoNativeAssetAddress) {
              // If user wants to redeem in ether simply transfer the funds back to user
              transactions.push({
                to: account,
                value: minCollateralAmount.toString(),
              })
            } else {
              // Transfer base token to the user
              transactions.push({
                to: userInputCollateral.address,
                data: ERC20Service.encodeTransfer(account, minCollateralAmount),
              })
            }
          } else {
            // Transfer unwrapped asset back to user
            transactions.push({
              to: account,
              value: totalAmountToSend.toString(),
            })
          }
        } else {
          transactions.push({
            to: collateralAddress,
            data: ERC20Service.encodeTransfer(account, totalAmountToSend),
          })
        }
      }

      // If relay used, keep reward tokens in relay
      if (!this.cpk.relay) {
        // Calculate amount to send from CPK to EOA
        // claimable rewards + unclaimed rewards (if any)
        const stakingService = new StakingService(this.provider, this.cpk.address, campaignAddress)
        const rewardTokens = await stakingService.getRewardTokens()
        const claimableRewards = await stakingService.getClaimableRewards(this.cpk.address)

        for (let i = 0; i < rewardTokens.length; i++) {
          const rewardErc20Service = new ERC20Service(this.provider, this.cpk.address, rewardTokens[i])
          const unclaimedRewards = bigNumberify(await rewardErc20Service.getCollateral(this.cpk.address))
          const totalRewardsAmount = claimableRewards[i].add(unclaimedRewards)

          const hasEnoughRewardAllowance = await rewardErc20Service.hasEnoughAllowance(
            this.cpk.address,
            account,
            totalRewardsAmount,
          )

          // Approve unlimited if not already done
          if (!hasEnoughRewardAllowance) {
            transactions.push({
              to: rewardTokens[i],
              data: ERC20Service.encodeApproveUnlimited(account),
            })
          }

          // Transfer all rewards from cpk to EOA
          transactions.push({
            to: rewardTokens[i],
            data: ERC20Service.encodeTransfer(account, totalRewardsAmount),
          })
        }
      }

      return this.execTransactions(transactions, txOptions, setTxHash, setTxState)
    } catch (err) {
      logger.error(`There was an error unstaking, claiming and withdrawing funding`, err.message)
      throw err
    }
  }

  unstakeAndClaim = async (campaignAddress: string) => {
    try {
      const signer = this.provider.getSigner()
      const account = await signer.getAddress()
      const network = await this.provider.getNetwork()
      const networkId = network.chainId

      const transactions: Transaction[] = []
      const txOptions: TxOptions = {}
      txOptions.gas = defaultGas

      transactions.push({
        to: campaignAddress,
        data: StakingService.encodeExit(this.cpk.address),
      })

      // If relay used, keep reward tokens in relay
      if (!this.cpk.relay) {
        // Calculate amount to send from CPK to EOA
        // claimable rewards + unclaimed rewards (if any)
        const stakingService = new StakingService(this.provider, this.cpk.address, campaignAddress)
        const rewardTokens = await stakingService.getRewardTokens()
        const claimableRewards = await stakingService.getClaimableRewards(this.cpk.address)

        for (let i = 0; i < rewardTokens.length; i++) {
          const erc20Service = new ERC20Service(this.provider, this.cpk.address, rewardTokens[i])
          const unclaimedRewards = bigNumberify(await erc20Service.getCollateral(this.cpk.address))
          const totalRewardsAmount = claimableRewards[i].add(unclaimedRewards)

          const hasEnoughAllowance = await erc20Service.hasEnoughAllowance(
            this.cpk.address,
            account,
            totalRewardsAmount,
          )

          // Approve unlimited if not already done
          if (!hasEnoughAllowance) {
            transactions.push({
              to: rewardTokens[i],
              data: ERC20Service.encodeApproveUnlimited(account),
            })
          }

          // Transfer all rewards from cpk to EOA
          transactions.push({
            to: rewardTokens[i],
            data: ERC20Service.encodeTransfer(account, totalRewardsAmount),
          })
        }
      }

      const txObject = await this.cpk.execTransactions(transactions, txOptions)
      return txObject.hash
    } catch (e) {
      logger.error('Failed to withdraw staked pool tokens and claim reward tokens', e.message)
      throw e
    }
  }
}

export { CPKService }
