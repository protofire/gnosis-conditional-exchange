import { useEffect, useMemo, useState } from 'react'

import { ConnectedWeb3Context } from '../contexts/connectedWeb3'
import { CompoundService } from '../services'
import { CompoundTokenType, Token } from '../util/types'

export const useCompoundService = (
  collateral: Token | null,
  context: ConnectedWeb3Context,
): {
  compoundService: Maybe<CompoundService>
  fetchCompoundService: () => Promise<void>
} => {
  const { account, library: provider } = context

  const [compoundService, setCompoundService] = useState<Maybe<CompoundService>>(null)

  const fetchCompoundService = async () => {
    if (compoundService) {
      await compoundService.init()
      setCompoundService(compoundService)
    }
  }

  useMemo(() => {
    if (collateral && collateral.symbol && collateral.symbol.toLowerCase() in CompoundTokenType) {
      const compoundService = new CompoundService(collateral.address, collateral.symbol, provider, account)
      setCompoundService(compoundService)
      fetchCompoundService()
    }
    // eslint-disable-next-line
  }, [collateral?.address, account, collateral?.symbol, provider])

  useEffect(() => {
    if (collateral && collateral.symbol && collateral.symbol.toLowerCase() in CompoundTokenType) {
      const compoundService = new CompoundService(collateral.address, collateral.symbol, provider, account)
      setCompoundService(compoundService)
      fetchCompoundService()
    }
    // eslint-disable-next-line
  }, [])

  return { compoundService, fetchCompoundService }
}
