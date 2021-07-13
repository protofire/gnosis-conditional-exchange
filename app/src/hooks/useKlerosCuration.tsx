import { useCallback, useEffect, useState } from 'react'

import { ConnectedWeb3Context } from '../contexts/connectedWeb3'
import { getLogger } from '../util/logger'
import { waitForBlockToSync } from '../util/networks'
import { KlerosCurationData, MarketMakerData, Status } from '../util/types'

import { useContracts } from './useContracts'

const logger = getLogger('KlerosCuration')

type Result = {
  data: Maybe<KlerosCurationData>
  syncAndRefetchData: (blockNum: number) => Promise<void>
  status: Status
  error: Maybe<Error>
}

export const useKlerosCuration = (
  marketMakerData: MarketMakerData,
  context: ConnectedWeb3Context,
  fetchGraphMarketMakerData: () => Promise<void>,
): Result => {
  const { kleros } = useContracts(context)
  const [data, setData] = useState<Maybe<KlerosCurationData>>(null)
  const [error, setError] = useState<Maybe<Error>>(null)
  const [loading, setLoading] = useState<boolean>(false)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)

      fetchGraphMarketMakerData()

      const [
        listingCriteriaURL,
        submissionDeposit,
        challengePeriodDuration,
        submissionBaseDeposit,
        removalBaseDeposit,
        marketVerificationData,
      ] = await Promise.all([
        kleros.getListingCriteriaURL(),
        kleros.getSubmissionDeposit(),
        kleros.getChallengePeriodDuration(),
        kleros.getSubmissionBaseDeposit(),
        kleros.getRemovalBaseDeposit(),
        kleros.getMarketState(marketMakerData),
      ])

      setData({
        listingCriteriaURL,
        submissionDeposit: submissionDeposit.toString(),
        challengePeriodDuration: challengePeriodDuration.toString(),
        submissionBaseDeposit: submissionBaseDeposit.toString(),
        removalBaseDeposit: removalBaseDeposit.toString(),
        marketVerificationData,
        ovmAddress: kleros.omenVerifiedMarkets.address,
      })
      setError(null)
    } catch (_err) {
      const errorMessage = 'Error fetching market validity curation data.'
      logger.error(errorMessage)
      setError(new Error(errorMessage))
    } finally {
      setLoading(false)
    }
  }, [kleros, marketMakerData, fetchGraphMarketMakerData])

  useEffect(() => {
    if (loading || !kleros || data || error) return

    fetchData()
  }, [data, error, fetchData, kleros, loading])

  const syncAndRefetchData = async (blockNum: number): Promise<void> => {
    await waitForBlockToSync(context.networkId, blockNum)
    await kleros.waitForBlockToSync(blockNum)
    await fetchData()
  }

  // Setup event listener after fetching data.
  useEffect(() => {
    if (!kleros || error) return

    kleros.omenVerifiedMarkets.on('ItemStatusChange', (...args) => {
      const event = args.pop()
      syncAndRefetchData(event.blockNumber)
    })

    kleros.omenVerifiedMarkets.on('Dispute', (...args) => {
      const event = args.pop()
      syncAndRefetchData(event.blockNumber)
    })

    return () => {
      kleros.omenVerifiedMarkets.removeAllListeners('ItemStatusChange')
      kleros.omenVerifiedMarkets.removeAllListeners('Dispute')
    }
    // eslint-disable-next-line
  }, [error, fetchData, kleros])

  return {
    data,
    error,
    syncAndRefetchData,
    status: error ? Status.Error : loading ? Status.Loading : Status.Ready,
  }
}
