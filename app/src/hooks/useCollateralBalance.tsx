import { BigNumber } from 'ethers/utils'
import { useEffect, useState } from 'react'

import { ConnectedWeb3Context } from '../contexts/connectedWeb3'
import { ERC20Service } from '../services'
import { pseudoNativeAssetAddress } from '../util/networks'
import { Token } from '../util/types'

export const fetchBalance = async (collateral: Token, context: ConnectedWeb3Context) => {
  const { account, library: provider } = context
  let collateralBalance = new BigNumber(0)
  if (account) {
    if (collateral.address === pseudoNativeAssetAddress) {
      collateralBalance = await provider.getBalance(account)
    } else {
      const collateralService = new ERC20Service(provider, account, collateral.address)
      collateralBalance = await collateralService.getCollateral(account)
    }
  }
  return collateralBalance
}

export const useCollateralBalance = (
  collateral: Token,
  context: ConnectedWeb3Context,
): {
  collateralBalance: Maybe<BigNumber>
  fetchCollateralBalance: () => Promise<void>
  errorMessage: Maybe<string>
} => {
  const { account, library: provider } = context

  const [collateralBalance, setCollateralBalance] = useState<Maybe<BigNumber>>(null)
  const [errorMessage, setErrorMessage] = useState<Maybe<string>>(null)

  const fetchCollateralBalance = async () => {
    let collateralBalance = new BigNumber(0)
    setErrorMessage(null)
    try {
      if (account) {
        if (collateral.address === pseudoNativeAssetAddress) {
          collateralBalance = await provider.getBalance(account)
        } else {
          const collateralService = new ERC20Service(provider, account, collateral.address)
          collateralBalance = await collateralService.getCollateral(account)
        }
      }
      setErrorMessage(null)
    } catch (e) {
      setErrorMessage(e.message)
    }
    setCollateralBalance(collateralBalance)
  }

  useEffect(() => {
    fetchCollateralBalance()
    // eslint-disable-next-line
  }, [account, provider, collateral.symbol])

  return { collateralBalance, fetchCollateralBalance, errorMessage }
}
