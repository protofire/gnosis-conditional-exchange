import { Contract, ethers, Wallet } from 'ethers'
import { LogDescription } from 'ethers/utils/interface'

import { Market, Log } from '../util/types'
import { FEE } from '../common/constants'

const marketMakerFactoryAbi = [
  `function createFixedProductMarketMaker(address conditionalTokens, address collateralToken, bytes32[] conditionIds, uint fee) public returns (address)`,
  `event FixedProductMarketMakerCreation(address indexed creator, address fixedProductMarketMaker, address conditionalTokens, address collateralToken, bytes32[] conditionIds, uint fee)`,
]
const marketMakerFactoryCallAbi = [
  `function createFixedProductMarketMaker(address conditionalTokens, address collateralToken, bytes32[] conditionIds, uint fee) public constant returns (address)`,
]

class MarketMakerFactoryService {
  contract: Contract
  constantContract: Contract
  signerAddress: string
  provider: any

  constructor(address: string, provider: any, signerAddress: string) {
    if (Object.prototype.hasOwnProperty.call(provider, 'getSigner')) {
      const signer: Wallet = provider.getSigner()
      this.contract = new ethers.Contract(address, marketMakerFactoryAbi, provider).connect(signer)
    } else {
      this.contract = new ethers.Contract(address, marketMakerFactoryAbi, provider)
    }

    this.constantContract = new ethers.Contract(address, marketMakerFactoryCallAbi, provider)
    this.signerAddress = signerAddress
    this.provider = provider
  }

  createMarketMaker = async (
    conditionalTokenAddress: string,
    collateralAddress: string,
    conditionId: string,
  ) => {
    const args = [conditionalTokenAddress, collateralAddress, [conditionId], FEE]

    const marketMakerAddress = await this.constantContract.createFixedProductMarketMaker(...args, {
      from: this.signerAddress,
    })

    const transactionObject = await this.contract.createFixedProductMarketMaker(...args, {
      value: '0x0',
    })
    await this.provider.waitForTransaction(transactionObject.hash)

    return marketMakerAddress
  }

  getMarkets = async (provider: any): Promise<Market[]> => {
    const filter: any = this.contract.filters.FixedProductMarketMakerCreation()

    const logs = await provider.getLogs({
      ...filter,
      fromBlock: 1,
      toBlock: 'latest',
    })

    if (logs.length === 0) {
      return []
    }

    const interfaceMarketMakerFactory = new ethers.utils.Interface(marketMakerFactoryAbi)
    const markets = logs.map(
      (log: Log): Market => {
        const parsedLog: LogDescription = interfaceMarketMakerFactory.parseLog(log)
        const { fixedProductMarketMaker, creator, collateralToken, conditionIds } = parsedLog.values

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
}

export { MarketMakerFactoryService }
