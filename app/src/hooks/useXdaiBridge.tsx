import { Zero } from 'ethers/constants'
import { BigNumber, bigNumberify } from 'ethers/utils'
import { useEffect, useState } from 'react'

import { XdaiService } from '../services'
import { knownTokens, networkIds } from '../util/networks'
import { formatBigNumber } from '../util/tools'
import { TransactionStep } from '../util/types'

import { useConnectedCPKContext } from './connectedCpk'
import { useConnectedWeb3Context } from './connectedWeb3'

interface Prop {
  transactionHash: string
  transferFunction: any
  fetchUnclaimedAssets: any
  daiBalance: BigNumber
  xDaiBalance: BigNumber
  transactionStep: TransactionStep
  claimLatestToken: any
  unclaimedAmount: BigNumber
  claimState: boolean
  isClaimStateTransaction: boolean
  numberOfConfirmations: any
  fetchBalance: any
}

export const useXdaiBridge = (amount?: BigNumber): Prop => {
  const [transactionStep, setTransactionStep] = useState<TransactionStep>(TransactionStep.idle)
  const { account, library: provider, networkId, relay } = useConnectedWeb3Context()
  const [xDaiBalance, setXdaiBalance] = useState<BigNumber>(Zero)
  const [daiBalance, setDaiBalance] = useState<BigNumber>(Zero)
  const [numberOfConfirmations, setNumberOfConfirmations] = useState<any>(0)
  const [isClaimStateTransaction, setIsClaimStateTransaction] = useState<boolean>(false)
  const [unclaimedAmount, setUnclaimedAmount] = useState<BigNumber>(Zero)
  const [claimState, setClaimState] = useState<boolean>(false)
  const [transactionHash, setTransactionHash] = useState<string>('')
  const cpk = useConnectedCPKContext()
  const { decimals } = knownTokens['dai']

  const transferFunction = async () => {
    try {
      if (!cpk || !amount) return
      if (networkId === networkIds.MAINNET) {
        setTransactionStep(TransactionStep.waitingConfirmation)

        const transaction = await cpk.sendDaiToBridge(amount)

        setTransactionHash(transaction.hash)
        setTransactionStep(TransactionStep.transactionSubmitted)

        // await waitForConfirmations(transaction, cpk, setNumberOfConfirmations, networkId)

        setTransactionStep(TransactionStep.transactionConfirmed)
        setNumberOfConfirmations(0)
      } else {
        const amountInFloat = formatBigNumber(amount, decimals)

        if (parseInt(amountInFloat) < 10) {
          setTransactionStep(TransactionStep.error)
          return
        }
        setTransactionStep(TransactionStep.waitingConfirmation)

        const transaction = await cpk.sendXdaiToBridge(amount)

        setTransactionHash(transaction)
        setTransactionStep(TransactionStep.transactionSubmitted)

        // await waitForConfirmations(transaction, cpk, setNumberOfConfirmations, networkId)
        setNumberOfConfirmations(0)
        setTransactionStep(TransactionStep.transactionConfirmed)
      }
      await fetchBalance()
    } catch (err) {
      setTransactionStep(TransactionStep.error)
      console.error(`Error while transferring! ${err}`)
    }
  }

  const claimAllTokens = async () => {
    try {
      if (!cpk) return
      const transaction = await cpk.claimAllTokens()
      return transaction.hash
    } catch (e) {
      setIsClaimStateTransaction(false)
      setTransactionStep(TransactionStep.error)
      console.error(`Error while claiming DAI! ${e}`)
    }
  }

  const fetchBalance = async () => {
    try {
      const xDaiService = new XdaiService(provider)
      const responseXdai = await xDaiService.fetchCrossChainBalance(100)

      setXdaiBalance(bigNumberify(responseXdai))
      const responseDai = await xDaiService.fetchCrossChainBalance(1)

      setDaiBalance(bigNumberify(responseDai))
    } catch (error) {
      console.error(`Error while fetching balance ${error}`)
    }
  }
  const fetchUnclaimedAssets = async () => {
    const xDaiService = new XdaiService(provider)
    const transactions = await xDaiService.fetchXdaiTransactionData()

    if (transactions) {
      let aggregator: BigNumber = Zero
      for (const { value } of transactions) {
        aggregator = aggregator.add(value)
      }
      setClaimState(true)

      setUnclaimedAmount(aggregator)
      return
    }

    setClaimState(false)
    setUnclaimedAmount(Zero)
  }

  useEffect(() => {
    if (account) {
      fetchBalance()
      if (networkId === networkIds.MAINNET || relay) {
        fetchUnclaimedAssets()
      }
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [networkId, account, provider])

  return {
    claimLatestToken: claimAllTokens,
    transferFunction,
    fetchUnclaimedAssets,
    isClaimStateTransaction,
    transactionHash,
    unclaimedAmount,
    claimState,
    numberOfConfirmations,
    transactionStep,
    daiBalance,
    xDaiBalance,
    fetchBalance,
  }
}
