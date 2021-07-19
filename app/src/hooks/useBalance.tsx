import { Zero } from 'ethers/constants'
import { BigNumber } from 'ethers/utils'
import { useEffect, useState } from 'react'

import { STANDARD_DECIMALS } from '../common/constants'
import { useTokens } from '../hooks'
import { XdaiService } from '../services'
import { getLogger } from '../util/logger'
import { bridgeTokensList, getNativeAsset, networkIds } from '../util/networks'
import { bigNumberToString } from '../util/tools'
import { KnownTokenValue, Token } from '../util/types'

const logger = getLogger('Hooks::ConnectedBalance')

export interface ConnectedBalance {
  nativeBalance: BigNumber
  formattedNativeBalance: string
  daiBalance: BigNumber
  xOmenBalance: BigNumber
  xDaiBalance: BigNumber
  formattedxDaiBalance: string
  omenBalance: BigNumber
  mainnetTokens: Token[]
  xDaiTokens: Token[]
  arrayOfClaimableTokenBalances: KnownTokenValue[]
  fetchBalances: () => Promise<void>
  fetched: boolean
}

type Status = {
  active: boolean
}

export const useBalance = (props: any) => {
  const context = props

  const [arrayOfClaimableTokenBalances, setArrayOfClaimableTokenBalances] = useState<KnownTokenValue[]>([])

  // mainnet balances
  const { refetch, tokens: mainnetTokens } = useTokens(context && context.rawWeb3Context, true, true, false, true)

  // xDai balances
  const { refetch: fetchXdaiTokens, tokens: xDaiTokens } = useTokens(context, true, true)

  const nativeBalance = context
    ? new BigNumber(
        mainnetTokens.filter(token => token.symbol === getNativeAsset(context.networkId).symbol)[0]?.balance || '',
      )
    : new BigNumber('0')

  // mainnet balances
  const daiBalance = new BigNumber(mainnetTokens.filter(token => token.symbol === 'DAI')[0]?.balance || '')
  const omenBalance = new BigNumber(mainnetTokens.filter(token => token.symbol === 'OMN')[0]?.balance || '')

  // xdai token balance
  const xDaiBalance = new BigNumber(xDaiTokens.filter(token => token.symbol === 'xDAI')[0]?.balance || '')
  const xOmenBalance = new BigNumber(xDaiTokens.filter(token => token.symbol === 'OMN')[0]?.balance || '')

  const fetchUnclaimedAssets = async () => {
    const aggregator = (array: any) => {
      return array.reduce((prev: BigNumber, { value }: any) => prev.add(value), Zero)
    }
    const arrayOfBalances: KnownTokenValue[] = []
    if (context && context.account && context.relay) {
      const xDaiService = new XdaiService(context.library)
      const daiTransactions = await xDaiService.fetchXdaiTransactionData()

      if (daiTransactions && daiTransactions.length) {
        const aggregatedDai: BigNumber = aggregator(daiTransactions)
        arrayOfBalances.push({ token: 'dai', value: aggregatedDai })
      }
      for (const token of bridgeTokensList) {
        if (token !== 'dai') {
          const transactions = await xDaiService.fetchOmniTransactionData(token)
          if (transactions.length !== 0) {
            const aggregated: BigNumber = aggregator(transactions)
            arrayOfBalances.push({ token: token, value: aggregated })
          }
        }
      }
    }
    setArrayOfClaimableTokenBalances(arrayOfBalances)
  }

  const fetchBalances = async (status?: Status) => {
    try {
      await Promise.all([fetchUnclaimedAssets(), refetch(status), fetchXdaiTokens(status)])
    } catch (e) {
      logger.log(e.message)
    }
  }

  useEffect(() => {
    const status = { active: true }
    setArrayOfClaimableTokenBalances([])
    fetchBalances(status)
    return () => {
      status.active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context])

  return {
    nativeBalance,
    formattedNativeBalance: bigNumberToString(
      nativeBalance,
      STANDARD_DECIMALS,
      context && context.networkId === networkIds.XDAI ? 2 : 3,
    ),
    daiBalance,
    xDaiBalance,
    formattedxDaiBalance: bigNumberToString(xDaiBalance, STANDARD_DECIMALS),
    fetchBalances,
    fetched: mainnetTokens.length > 0 && xDaiTokens.length > 0,
    omenBalance,
    xOmenBalance,
    mainnetTokens,
    xDaiTokens,
    arrayOfClaimableTokenBalances,
  }
}
