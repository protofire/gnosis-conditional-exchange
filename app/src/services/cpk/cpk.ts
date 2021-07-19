import { TransactionReceipt, Web3Provider } from 'ethers/providers'
import { BigNumber } from 'ethers/utils'

import { OMNI_BRIDGE_XDAI_ADDRESS, XDAI_TO_DAI_TOKEN_BRIDGE_ADDRESS } from '../../common/constants'
import { ConnectedWeb3Context } from '../../hooks'
import { Transaction, verifyProxyAddress } from '../../util/cpk'
import { getLogger } from '../../util/logger'
import {
  bridgeTokensList,
  getContractAddress,
  getTargetSafeImplementation,
  getTokenFromAddress,
  getWrapToken,
  networkIds,
  pseudoNativeAssetAddress,
} from '../../util/networks'
import { getBySafeTx, signaturesFormatted, waitABit, waitForBlockToSync } from '../../util/tools'
import { MarketData, Question, Token, TransactionStep } from '../../util/types'
import { ConditionalTokenService } from '../conditional_token'
import { ERC20Service } from '../erc20'
import { MarketMakerService } from '../market_maker'
import { MarketMakerFactoryService } from '../market_maker_factory'
import { OracleService } from '../oracle'
import { OvmService } from '../ovm'
import { RealitioService } from '../realitio'
import { RelayService } from '../relay'
import { SafeService } from '../safe'
import { UnwrapTokenService } from '../unwrap_token'
import { XdaiService } from '../xdai'

import {
  announceCondition,
  approve,
  buy,
  createMarket,
  createQuestion,
  exec,
  fee,
  pipe,
  prepareCondition,
  setup,
  transfer,
  wrangleMarketData,
  wrap,
} from './fns'

const logger = getLogger('Services::CPKService')

const defaultGas = 1500000

interface CPKBuyOutcomesParams {
  amount: BigNumber
  collateral: Token
  outcomeIndex: number
  marketMaker: MarketMakerService
}

interface CPKSellOutcomesParams {
  amount: BigNumber
  outcomeIndex: number
  marketMaker: MarketMakerService
  conditionalTokens: ConditionalTokenService
}

interface CPKCreateMarketParams {
  marketData: MarketData
  conditionalTokens: ConditionalTokenService
  realitio: RealitioService
  marketMakerFactory: MarketMakerFactoryService
}

interface CPKAddFundingParams {
  amount: BigNumber
  collateral: Token
  marketMaker: MarketMakerService
}

interface CPKRemoveFundingParams {
  amountToMerge: BigNumber
  conditionId: string
  conditionalTokens: ConditionalTokenService
  earnings: BigNumber
  marketMaker: MarketMakerService
  outcomesCount: number
  sharesToBurn: BigNumber
}

interface CPKRedeemParams {
  isScalar: boolean
  isConditionResolved: boolean
  question: Question
  numOutcomes: number
  earnedCollateral: BigNumber
  collateralToken: Token
  realitio: RealitioService
  oracle: OracleService
  marketMaker: MarketMakerService
  conditionalTokens: ConditionalTokenService
  realitioBalance: BigNumber
  scalarLow: Maybe<BigNumber>
  scalarHigh: Maybe<BigNumber>
}

interface CPKResolveParams {
  isScalar: boolean
  realitio: RealitioService
  oracle: OracleService
  question: Question
  numOutcomes: number
  scalarLow: Maybe<BigNumber>
  scalarHigh: Maybe<BigNumber>
}

interface CPKSubmitAnswerParams {
  realitio: RealitioService
  question: Question
  answer: string
  amount: BigNumber
}

interface TransactionResult {
  hash?: string
  safeTxHash?: string
}

export interface TxOptions {
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
  relayService: RelayService
  context?: ConnectedWeb3Context

  constructor(cpk: any, provider: Web3Provider, context?: ConnectedWeb3Context) {
    this.cpk = cpk
    this.provider = provider
    this.safe = new SafeService(cpk.address, provider)
    this.relayService = new RelayService()
    this.context = context
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

  execTransactions = async (transactions: Transaction[], txOptions?: TxOptions) => {
    if (this.cpk.relay) {
      const { address, fee } = await this.relayService.getInfo()
      transactions.push({
        to: address,
        value: fee,
      })
    }

    const txObject = await this.cpk.execTransactions(transactions, txOptions)
    this.context?.setTxState(TransactionStep.transactionSubmitted)
    this.context?.setTxHash(txObject.hash)
    const tx = await this.waitForTransaction(txObject)
    this.context?.setTxState(TransactionStep.transactionConfirmed)
    return tx
  }

  getGas = async (txOptions: TxOptions): Promise<void> => {
    if (this.isSafeApp) {
      txOptions.gas = defaultGas
    }
  }

  subRelayFee = async (amount: BigNumber) => {
    if (this.cpk.relay) {
      const { fee } = await this.relayService.getInfo()
      return amount.sub(fee)
    }
    return amount
  }

  pipe = (...fns: any) => (params: any) =>
    pipe(
      setup,
      ...fns,
      exec,
    )({ ...params, service: this, setTxHash: this.context?.setTxHash, setTxState: this.context?.setTxState })

  buyOutcomes = async (params: CPKBuyOutcomesParams): Promise<TransactionReceipt> => {
    try {
      const { transaction } = await this.pipe(fee, wrap, approve, transfer, buy)(params)
      return transaction
    } catch (err) {
      logger.error(`There was an error buying '${params.amount.toString()}' of shares`, err.message)
      throw err
    }
  }

  createMarket = async (params: CPKCreateMarketParams): Promise<CreateMarketResult> => {
    try {
      const { predictedMarketMakerAddress, transaction } = await this.pipe(
        wrangleMarketData,
        wrap,
        approve,
        transfer,
        createQuestion,
        prepareCondition,
        createMarket,
      )(params)
      return {
        transaction,
        marketMakerAddress: predictedMarketMakerAddress,
      }
    } catch (err) {
      logger.error(`There was an error creating the market maker`, err.message)
      throw err
    }
  }

  createScalarMarket = async (params: CPKCreateMarketParams): Promise<CreateMarketResult> => {
    try {
      const { predictedMarketMakerAddress, transaction } = await this.pipe(
        wrangleMarketData,
        wrap,
        approve,
        transfer,
        createQuestion,
        announceCondition,
        prepareCondition,
        createMarket,
      )(params)
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
    conditionalTokens,
    marketMaker,
    outcomeIndex,
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

      // unwrap native assets (e.g. WETH)
      const wrapTokenAddress = getWrapToken(this.cpk.relay ? networkIds.XDAI : networkId).address
      const unwrap = collateralAddress.toLowerCase() === wrapTokenAddress.toLowerCase()
      if (unwrap) {
        const collateralToken = getTokenFromAddress(networkId, collateralAddress)
        const encodedWithdrawFunction = UnwrapTokenService.withdrawAmount(collateralToken.symbol, amount)
        transactions.push({
          to: collateralAddress,
          data: encodedWithdrawFunction,
        })
      }

      // Transfer funding to user if not signed in as a safe app
      if (!this.isSafeApp) {
        if (unwrap) {
          transactions.push({
            to: account,
            value: amount.toString(),
          })
        } else {
          transactions.push({
            to: collateralAddress,
            data: ERC20Service.encodeTransfer(account, amount),
          })
        }
      }

      return this.execTransactions(transactions, txOptions)
    } catch (err) {
      logger.error(`There was an error selling '${amount.toString()}' of shares`, err.message)
      throw err
    }
  }

  addFunding = async ({ amount, collateral, marketMaker }: CPKAddFundingParams): Promise<TransactionReceipt> => {
    try {
      const signer = this.provider.getSigner()
      const account = await signer.getAddress()

      const network = await this.provider.getNetwork()
      const networkId = network.chainId

      const transactions: Transaction[] = []

      const txOptions: TxOptions = {}
      await this.getGas(txOptions)
      const fundingAmount = await this.subRelayFee(amount)

      let collateralAddress

      if (collateral.address === pseudoNativeAssetAddress) {
        collateralAddress = getWrapToken(networkId).address

        // fund the cpk
        if (!this.isSafeApp) {
          txOptions.value = fundingAmount
        }

        // wrap the asset
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

      // Step 3: Transfer funding from user to the CPK
      if (!this.isSafeApp && collateral.address !== pseudoNativeAssetAddress) {
        transactions.push({
          to: collateral.address,
          data: ERC20Service.encodeTransferFrom(account, this.cpk.address, fundingAmount),
        })
      }

      // Step 4: Add funding to market
      transactions.push({
        to: marketMaker.address,
        data: MarketMakerService.encodeAddFunding(fundingAmount),
      })

      return this.execTransactions(transactions, txOptions)
    } catch (err) {
      logger.error(`There was an error adding an amount of '${amount.toString()}' for funding`, err.message)
      throw err
    }
  }

  removeFunding = async ({
    amountToMerge,
    conditionId,
    conditionalTokens,
    earnings,
    marketMaker,
    outcomesCount,
    sharesToBurn,
  }: CPKRemoveFundingParams): Promise<TransactionReceipt> => {
    try {
      const signer = this.provider.getSigner()
      const account = await signer.getAddress()
      const network = await this.provider.getNetwork()
      const collateralAddress = await marketMaker.getCollateralToken()
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

      const totalAmountToSend = amountToMerge.add(earnings)

      // transfer to the user the merged collateral plus the earned fees
      const wrapToken = getWrapToken(this.cpk.relay ? networkIds.XDAI : networkId)
      const unwrap = collateralAddress.toLowerCase() === wrapToken.address.toLowerCase()
      if (unwrap) {
        const encodedWithdrawFunction = UnwrapTokenService.withdrawAmount(wrapToken.symbol, totalAmountToSend)
        transactions.push({
          to: collateralAddress,
          data: encodedWithdrawFunction,
        })
      }

      // Transfer asset back to user
      if (!this.isSafeApp) {
        if (unwrap) {
          transactions.push({
            to: account,
            value: totalAmountToSend.toString(),
          })
        } else {
          transactions.push({
            to: collateralAddress,
            data: ERC20Service.encodeTransfer(account, totalAmountToSend),
          })
        }
      }

      return this.execTransactions(transactions, txOptions)
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
    isScalar,
    marketMaker,
    numOutcomes,
    oracle,
    question,
    realitio,
    realitioBalance,
    scalarHigh,
    scalarLow,
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

        const data = await realitio.encodeClaimWinnings(question.id)
        if (data) {
          transactions.push({
            to: realitio.contract.address,
            data,
          })
        }
      }

      if (!earnedCollateral.isZero()) {
        const conditionId = await marketMaker.getConditionId()

        transactions.push({
          to: conditionalTokens.address,
          data: ConditionalTokenService.encodeRedeemPositions(collateralToken.address, conditionId, numOutcomes),
        })

        const wrapToken = getWrapToken(this.cpk.relay ? networkIds.XDAI : networkId)
        const unwrap = collateralToken.address.toLowerCase() === wrapToken.address.toLowerCase()
        if (unwrap) {
          const encodedWithdrawFunction = UnwrapTokenService.withdrawAmount(collateralToken.symbol, earnedCollateral)
          transactions.push({
            to: collateralToken.address,
            data: encodedWithdrawFunction,
          })
        }

        // If we are signed in as a safe we don't need to transfer
        if (!this.isSafeApp) {
          if (unwrap) {
            transactions.push({
              to: account,
              value: earnedCollateral.toString(),
            })
          } else {
            transactions.push({
              to: collateralToken.address,
              data: ERC20Service.encodeTransfer(account, earnedCollateral),
            })
          }
        }
      }

      // If user has realitio balance, withdraw
      if (!realitioBalance.isZero()) {
        transactions.push({
          to: getContractAddress(networkId, 'realitio'),
          data: RealitioService.encodeWithdraw(),
        })

        if (!this.isSafeApp) {
          transactions.push({
            to: account,
            value: realitioBalance.toString(),
          })
        }
      }

      return this.execTransactions(transactions, txOptions)
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

      const data = await realitio.encodeClaimWinnings(question.id)
      if (data) {
        transactions.push({
          to: realitio.contract.address,
          data,
        })
      }

      return this.execTransactions(transactions, txOptions)
    } catch (err) {
      logger.error(`There was an error resolving the condition with question id '${question.id}'`, err.message)
      throw err
    }
  }

  submitAnswer = async ({ amount, answer, question, realitio }: CPKSubmitAnswerParams) => {
    try {
      const txOptions: TxOptions = {}
      if (!this.isSafeApp) {
        txOptions.value = amount
      }
      const transactions: Transaction[] = [
        {
          to: realitio.address,
          data: RealitioService.encodeSubmitAnswer(question.id, answer),
          value: amount.toString(),
        },
      ]
      await this.getGas(txOptions)
      return this.execTransactions(transactions, txOptions)
    } catch (error) {
      logger.error(`There was an error submitting answer '${question.id}'`, error.message)
      throw error
    }
  }

  proxyIsUpToDate = async (): Promise<boolean> => {
    const network = await this.provider.getNetwork()
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

  sendMainnetTokenToBridge = async (amount: BigNumber, address: string, symbol?: string) => {
    try {
      if (this.cpk.relay) {
        const xDaiService = new XdaiService(this.provider)
        const contract = await xDaiService.generateXdaiBridgeContractInstance(symbol)

        const sender = await this.cpk.ethLibAdapter.signer.signer.getAddress()

        const receiver = this.cpk.address

        // verify proxy address before deposit
        await verifyProxyAddress(sender, receiver, this.cpk)

        const transaction = await contract.relayTokens(symbol === 'DAI' ? sender : address, receiver, amount)
        return transaction.hash
      } else {
        const xDaiService = new XdaiService(this.provider)
        const contract = await xDaiService.generateErc20ContractInstance(address)
        const transaction = await xDaiService.generateSendTransaction(amount, contract, symbol)
        return transaction
      }
    } catch (e) {
      logger.error(`Error trying to send Dai to bridge address: `, e.message)
      throw e
    }
  }

  sendXdaiChainTokenToBridge = async (amount: BigNumber, address: string, symbol?: string) => {
    try {
      if (this.cpk.relay) {
        const transactions: Transaction[] = []
        const txOptions: TxOptions = {}
        await this.getGas(txOptions)

        // get mainnet relay signer
        const to = await this.cpk.ethLibAdapter.signer.signer.getAddress()

        // relay to signer address on mainnet
        if (symbol === 'DAI') {
          transactions.push({
            to: XDAI_TO_DAI_TOKEN_BRIDGE_ADDRESS,
            data: XdaiService.encodeRelayTokens(to),
            value: amount.toString(),
          })
          const { transactionHash } = await this.execTransactions(transactions, txOptions)
          return transactionHash
        } else {
          transactions.push({
            to: address,
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
      const arrayOfTransactions = []
      const daiData = await xDaiService.fetchXdaiTransactionData()
      arrayOfTransactions.push(...daiData)

      for (const token of bridgeTokensList) {
        if (token !== 'dai') {
          const currentToken = await xDaiService.fetchOmniTransactionData(token)

          if (currentToken.length !== 0) arrayOfTransactions.push(...currentToken)
        }
      }

      return arrayOfTransactions
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
      logger.error(`Error trying to claim tokens from xDai bridge`, e.message)
      throw e
    }
  }
}

export { CPKService }
