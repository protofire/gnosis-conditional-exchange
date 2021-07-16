import { Contract, Wallet, ethers, utils } from 'ethers'
import { BigNumber } from 'ethers/utils'
import { LogDescription } from 'ethers/utils/interface'

import { MARKET_FEE } from '../common/constants'
import { getLogger } from '../util/logger'
import { getContractAddress } from '../util/networks'
import { Log, Market, MarketWithExtraData } from '../util/types'

import { ConditionalTokenService } from './conditional_token'
import { MarketMakerService } from './market_maker'
import { RealitioService } from './realitio'

const logger = getLogger('Services::MarketMakerFactory')

interface GetMarketsOptions {
  from: number
  to: number
}

const marketMakerFactoryAbi = [
  `function create2FixedProductMarketMaker(
     uint saltNonce,
     address conditionalTokens,
     address collateralToken,
     bytes32[] conditionIds,
     uint fee,
     uint initialFunds,
     uint[] distributionHint
  ) public returns (address)`,
  'function implementationMaster() public constant returns (address)',
  `event FixedProductMarketMakerCreation(address indexed creator, address fixedProductMarketMaker, address conditionalTokens, address collateralToken, bytes32[] conditionIds, uint fee)`,
]

const marketMakerFactoryCallAbi = [
  `function create2FixedProductMarketMaker(
     uint saltNonce,
     address conditionalTokens,
     address collateralToken,
     bytes32[] conditionIds,
     uint fee,
     uint initialFunds,
     uint[] distributionHint
  ) public constant returns (address)`,
]

class MarketMakerFactoryService {
  contract: Contract
  constantContract: Contract
  signerAddress: Maybe<string>
  provider: any

  constructor(address: string, provider: any, signerAddress: Maybe<string>) {
    if (signerAddress) {
      const signer: Wallet = provider.getSigner()

      this.contract = new ethers.Contract(address, marketMakerFactoryAbi, provider).connect(signer)
    } else {
      this.contract = new ethers.Contract(address, marketMakerFactoryAbi, provider)
    }

    this.constantContract = new ethers.Contract(address, marketMakerFactoryCallAbi, provider)
    this.signerAddress = signerAddress
    this.provider = provider
  }

  get address(): string {
    return this.contract.address
  }

  predictMarketMakerAddress = async (
    saltNonce: number,
    conditionalTokenAddress: string,
    collateralAddress: string,
    conditionId: string,
    signerAddress: string,
    spread: number,
    networkId: number,
  ): Promise<string> => {
    const feeBN = ethers.utils.parseEther('' + spread / Math.pow(10, 2))
    const cloneFactoryInterface = new utils.Interface(['function cloneConstructor(bytes consData) external'])
    let cloneConstructorEncodedCall
    const v2 = getContractAddress(networkId, 'marketMakerFactoryV2')

    if (this.contract.address.toLowerCase() === v2.toLowerCase()) {
      cloneConstructorEncodedCall = cloneFactoryInterface.functions.cloneConstructor.encode([
        utils.defaultAbiCoder.encode(
          ['address', 'address', 'bytes32[]', 'uint', 'address'],
          [conditionalTokenAddress, collateralAddress, [conditionId], feeBN, v2],
        ),
      ])
    } else {
      cloneConstructorEncodedCall = cloneFactoryInterface.functions.cloneConstructor.encode([
        utils.defaultAbiCoder.encode(
          ['address', 'address', 'bytes32[]', 'uint'],
          [conditionalTokenAddress, collateralAddress, [conditionId], feeBN],
        ),
      ])
    }

    const implementationMaster = await this.contract.implementationMaster()

    return `0x${utils
      .solidityKeccak256(
        ['bytes', 'address', 'bytes32', 'bytes32'],
        [
          '0xff',
          this.contract.address,
          utils.keccak256(utils.defaultAbiCoder.encode(['address', 'uint'], [signerAddress, saltNonce])),
          utils.keccak256(
            `0x3d3d606380380380913d393d73${this.contract.address.slice(
              2,
            )}5af4602a57600080fd5b602d8060366000396000f3363d3d373d3d3d363d73${implementationMaster.slice(
              2,
            )}5af43d82803e903d91602b57fd5bf3${cloneConstructorEncodedCall.replace(/^0x/, '')}`,
          ),
        ],
      )
      .slice(-40)}`
  }

  createMarketMaker = async (
    saltNonce: number,
    conditionalTokenAddress: string,
    collateralAddress: string,
    conditionId: string,
  ): Promise<string> => {
    const feeBN = ethers.utils.parseEther('' + MARKET_FEE / Math.pow(10, 2))

    const args = [saltNonce, conditionalTokenAddress, collateralAddress, [conditionId], feeBN, 0, []]

    const marketMakerAddress = await this.constantContract.create2FixedProductMarketMaker(...args, {
      from: this.signerAddress,
    })

    const transactionObject = await this.contract.create2FixedProductMarketMaker(...args, {
      value: '0x0',
    })
    await this.provider.waitForTransaction(transactionObject.hash)

    return marketMakerAddress
  }

  getMarkets = async ({ from, to }: GetMarketsOptions): Promise<Market[]> => {
    logger.debug(`Fetching markets from '${from}' to '${to}'`)
    const filter: any = this.contract.filters.FixedProductMarketMakerCreation()

    const logs = await this.provider.getLogs({
      ...filter,
      fromBlock: from,
      toBlock: to,
    })

    if (logs.length === 0) {
      return []
    }

    const interfaceMarketMakerFactory = new ethers.utils.Interface(marketMakerFactoryAbi)
    const markets = logs.map(
      (log: Log): Market => {
        const parsedLog: LogDescription = interfaceMarketMakerFactory.parseLog(log)
        const { collateralToken, conditionIds, creator, fixedProductMarketMaker } = parsedLog.values

        return {
          address: fixedProductMarketMaker,
          ownerAddress: creator,
          conditionId: conditionIds[0],
          collateralTokenAddress: collateralToken,
        }
      },
    )

    return markets
  }

  getMarketsWithExtraData = async (
    { from, to }: GetMarketsOptions,
    conditionalTokens: ConditionalTokenService,
    realitio: RealitioService,
  ): Promise<MarketWithExtraData[]> => {
    const markets = await this.getMarkets({ from, to })

    const marketsWithExtraData = await Promise.all(
      markets.map(market => {
        const marketMaker = new MarketMakerService(
          market.address,
          conditionalTokens,
          realitio,
          this.provider,
          this.signerAddress,
        )
        return marketMaker.getExtraData(market)
      }),
    )

    const feeBN = ethers.utils.parseEther('' + MARKET_FEE / Math.pow(10, 2))

    const validMarkets = marketsWithExtraData.filter(market => market.fee.eq(feeBN))

    return validMarkets
  }

  static encodeCreateMarketMaker = (
    saltNonce: number,
    conditionalTokenAddress: string,
    collateralAddress: string,
    conditionId: string,
    spread: number,
    initialFunds: BigNumber,
    distributionHint: BigNumber[],
  ): string => {
    const feeBN = ethers.utils.parseEther('' + spread / Math.pow(10, 2))

    const create2FixedProductMarketMakerInterface = new utils.Interface(marketMakerFactoryAbi)

    return create2FixedProductMarketMakerInterface.functions.create2FixedProductMarketMaker.encode([
      saltNonce,
      conditionalTokenAddress,
      collateralAddress,
      [conditionId],
      feeBN,
      initialFunds,
      distributionHint,
    ])
  }
}

export { MarketMakerFactoryService }
