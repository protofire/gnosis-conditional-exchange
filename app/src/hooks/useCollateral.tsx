import { useEffect, useState } from 'react'

import { ConnectedWeb3Context } from '../contexts/connectedWeb3'
import { ERC20Service } from '../services'
import { getTokenFromAddress } from '../util/networks'
import { Token } from '../util/types'

const getTokenFromAddressIfExists = (networkId: number, collateralAddress: string): Maybe<Token> => {
  try {
    return getTokenFromAddress(networkId, collateralAddress)
  } catch (err) {
    return null
  }
}

export const useCollateral = (
  collateralAddress: string,
  context: ConnectedWeb3Context,
): { collateral: Maybe<Token>; errorMessage: Maybe<string>; isSpinnerOn: boolean } => {
  const { account, library: provider, networkId } = context

  const [collateral, setCollateral] = useState<Maybe<Token>>(null)
  const [errorMessage, setErrorMessage] = useState<Maybe<string>>(null)
  const [isSpinnerOn, setSpinnerOn] = useState<boolean>(false)

  useEffect(() => {
    let isSubscribed = true

    const fetchIsValidErc20 = async () => {
      if (!collateralAddress) {
        return
      }

      if (isSubscribed) setSpinnerOn(true)
      let newCollateral = getTokenFromAddressIfExists(networkId, collateralAddress)
      let newErrorMessage: Maybe<string> = null

      // If the address doesn't belong to a knowToken, we fetch its metadata
      if (!newCollateral) {
        const erc20Service = new ERC20Service(provider, account, collateralAddress)
        const isValidErc20 = await erc20Service.isValidErc20()
        if (isValidErc20) {
          newCollateral = await erc20Service.getProfileSummary()
        } else {
          newErrorMessage = `The address is not a valid Erc20 token.`
        }
      }

      if (isSubscribed) {
        setCollateral(newCollateral)
        setSpinnerOn(false)
        setErrorMessage(newErrorMessage)
      }
    }

    fetchIsValidErc20()

    return () => {
      isSubscribed = false
    }
  }, [provider, account, networkId, collateralAddress])

  return {
    collateral,
    errorMessage,
    isSpinnerOn,
  }
}
