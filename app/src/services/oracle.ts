import Big from 'big.js'
import { Contract, Wallet, ethers, utils } from 'ethers'
import { TransactionReceipt } from 'ethers/providers'
import { BigNumber } from 'ethers/utils'

import { getLogger } from '../util/logger'
import { INVALID_ANSWER_ID, Question, TransactionStep } from '../util/types'

const logger = getLogger('Services::Oracle')

const oracleAbi = [
  'function resolve(bytes32 questionId, uint256 templateId, string question, uint256 numOutcomes) external',
  'function conditionalTokens() public view returns (address)',
  'function realitio() public view returns (address)',
]

export class OracleService {
  contract: Contract
  provider: any

  constructor(address: string, provider: any, signerAddress: Maybe<string>) {
    if (signerAddress) {
      const signer: Wallet = provider.getSigner()
      this.contract = new ethers.Contract(address, oracleAbi, provider).connect(signer)
    } else {
      this.contract = new ethers.Contract(address, oracleAbi, provider)
    }
    this.provider = provider
  }

  get address(): string {
    return this.contract.address
  }

  /**
   * Resolve the condition with the given questionId
   */
  resolveCondition = async (
    question: Question,
    numOutcomes: number,
    setTxHash?: (arg0: string) => void,
    setTxState?: (step: TransactionStep) => void,
  ): Promise<TransactionReceipt> => {
    try {
      const transactionObject = await this.contract.resolve(question.id, question.templateId, question.raw, numOutcomes)
      setTxState && setTxState(TransactionStep.transactionSubmitted)
      setTxHash && setTxHash(transactionObject.hash)
      const tx = this.provider.waitForTransaction(transactionObject.hash)
      setTxState && setTxState(TransactionStep.transactionConfirmed)
      return tx
    } catch (err) {
      logger.error(`There was an error resolving the condition with question id '${question.id}'`, err.message)
      throw err
    }
  }

  conditionalTokens = async () => {
    return await this.contract.conditionalTokens()
  }

  realitio = async () => {
    return await this.contract.realitio()
  }

  static encodeResolveCondition = (
    questionId: string,
    questionTemplateId: number,
    questionRaw: string,
    numOutcomes: number,
  ): string => {
    const oracleInterface = new utils.Interface(oracleAbi)

    return oracleInterface.functions.resolve.encode([questionId, questionTemplateId, questionRaw, numOutcomes])
  }

  static getPayouts = (templateId: number, realitioAnswer: string, numOutcomes: number): Big[] => {
    let payouts: Big[]
    if (realitioAnswer === INVALID_ANSWER_ID) {
      payouts = [...Array(numOutcomes)].map(() => new Big(1))
    } else {
      const answer = new BigNumber(realitioAnswer).toNumber()

      if (templateId === 0 || templateId === 2) {
        payouts = [...Array(numOutcomes)].map(() => new Big(0))
        payouts[answer] = new Big(1)
      } else if (templateId === 5 || templateId === 6) {
        payouts = [new Big(4 - answer), new Big(answer)]
      } else {
        throw new Error(`Unsupported template id: '${templateId}'`)
      }
    }

    const totalPayouts = payouts.reduce((a, b) => a.add(b))

    return payouts.map(payout => payout.div(totalPayouts))
  }
}
