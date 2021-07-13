import { Signer, constants } from 'ethers'
import { BigNumber } from 'ethers/utils'
import { useCallback, useEffect, useState } from 'react'

import { useConnectedWeb3Context } from '../contexts/connectedWeb3'
import { ERC20Service } from '../services'
import { pseudoNativeAssetAddress } from '../util/networks'
import { RemoteData } from '../util/remote_data'

/**
 * Return the allowance of the given `signer` for the cpk.
 *
 * It also returns two helper functions:
 * `updateAllowance` can be used to reload the value of the allowance
 * `unlock` can be used to set unlimited allowance for the cpk
 */
export const useCpkAllowance = (signer: Signer, tokenAddress: string) => {
  const { cpk } = useConnectedWeb3Context()
  const [allowance, setAllowance] = useState<RemoteData<BigNumber>>(RemoteData.notAsked())
  const provider = signer.provider

  const updateAllowance = useCallback(async () => {
    if (cpk && provider && tokenAddress !== pseudoNativeAssetAddress) {
      const account = await signer.getAddress()
      const collateralService = new ERC20Service(provider, account, tokenAddress)
      const allowance = await collateralService.allowance(account, cpk.address)
      setAllowance(RemoteData.success(allowance))
    }
  }, [tokenAddress, cpk, provider, signer])

  const unlock = useCallback(async () => {
    if (cpk) {
      setAllowance(RemoteData.load(allowance))

      const account = await signer.getAddress()
      const collateralService = new ERC20Service(provider, account, tokenAddress)
      try {
        await collateralService.approveUnlimited(cpk.address)
        setAllowance(RemoteData.success(constants.MaxUint256))
      } catch (e) {
        setAllowance(RemoteData.failure(e))
      }
    }
  }, [allowance, provider, cpk, signer, tokenAddress])

  useEffect(() => {
    updateAllowance()
  }, [updateAllowance])

  return {
    allowance,
    updateAllowance,
    unlock,
  }
}
