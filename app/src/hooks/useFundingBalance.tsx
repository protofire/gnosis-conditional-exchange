import { BigNumber } from 'ethers/utils'
import { useEffect, useState } from 'react'

import { ConnectedWeb3Context } from '../contexts/connectedWeb3'

import { useContracts } from './useContracts'

export const useFundingBalance = (
  marketMakerAddress: string,
  context: ConnectedWeb3Context,
): {
  fundingBalance: Maybe<BigNumber>
  fetchFundingBalance: () => Promise<void>
} => {
  const { account, cpk, library: provider } = context
  const { buildMarketMaker } = useContracts(context)

  const [fundingBalance, setFundingBalance] = useState<Maybe<BigNumber>>(null)

  const fetchFundingBalance = async () => {
    let fundingBalance = new BigNumber(0)

    if (account && cpk) {
      const marketMaker = buildMarketMaker(marketMakerAddress)
      fundingBalance = await marketMaker.balanceOf(cpk.address)
    }

    setFundingBalance(fundingBalance)
  }

  useEffect(() => {
    fetchFundingBalance()
    // eslint-disable-next-line
  }, [account, provider, buildMarketMaker, marketMakerAddress, cpk])

  return { fundingBalance, fetchFundingBalance }
}
